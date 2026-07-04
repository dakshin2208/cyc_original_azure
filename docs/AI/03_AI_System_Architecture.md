# AI College Counselor — System Architecture (03)

**Project:** ChooseYourCollege (CYC)
**Document type:** Solution Architecture — the design the AI College Counselor will be built to.
**Builds on:** [`01_Knowledge_Audit.md`](./01_Knowledge_Audit.md) (what knowledge exists) and [`02_Question_Audit.md`](./02_Question_Audit.md) (what will be asked). Every routing and grounding decision here traces to those two.
**Scope:** Architecture only — components, responsibilities, data flow, and the SQL/RAG/reasoning boundaries. **No code, no prompts, no library choices, no schema DDL.**

---

## 0. Design stance & principles

**This is not a document Q&A bot.** A RAG-over-documents bot retrieves text and paraphrases it. A *counselor* must do numeric prediction, apply admission business rules, compare entities on normalized metrics, weigh trade-offs, and give **grounded opinions** — most of which is *structured* work, not text retrieval. RAG is therefore **one retrieval mode among several**, used only for process/policy/FAQ knowledge; it is not the backbone.

Seven principles govern the design:

1. **Deterministic core, probabilistic shell.** Facts, math, eligibility, and rules run in deterministic engines. The LLM plans, reasons over evidence, and explains — it never *recalls* college facts from its weights.
2. **Structured-first.** Per doc 02, ~70% of question volume is answerable from L1–L4 structured data; SQL is the workhorse, RAG the specialist.
3. **Ground or abstain.** Every claim is traceable to a retrieved/computed source. When data is missing (`FEES`, `CALENDAR`, `SEAT-MATRIX`…), the system **says so** rather than fabricating (doc 02 §11).
4. **Opinions are labeled and evidenced.** "Which is better" is answered — but as a reasoned verdict *over deterministic facts*, with the facts shown.
5. **Rules are auditable.** Risk tiers, category logic, entitlement gating, and scoring weights live in code/config, not in a prompt.
6. **Privacy by construction.** All user data (L5) is auth-scoped; the PII-governance hole from doc 01 §4 is a hard prerequisite gate.
7. **Explainable by default.** The counselor must justify recommendations — which is only possible because L4 parameters (doc 01) are formula-defined.

---

## 1. Overall AI Architecture

A layered, orchestrated, tool-augmented agent. Six planes:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CONVERSATION PLANE      Response Generator · Memory Layer                   │
├──────────────────────────────────────────────────────────────────────────┤
│ ORCHESTRATION PLANE     AI Orchestrator ── Intent Classifier                │
├──────────────────────────────────────────────────────────────────────────┤
│ ENGINE PLANE (domain)   Prediction · Comparison · Recommendation · Knowledge│
├──────────────────────────────────────────────────────────────────────────┤
│ RETRIEVAL PLANE         Retrieval Layer ─┬─ SQL Layer      ─┬─ RAG Layer     │
│                                          │  (L1–L5 tables)  │  (curated KB)  │
├──────────────────────────────────────────────────────────────────────────┤
│ FOUNDATION PLANE        LLM Layer · Prompt Layer                            │
├──────────────────────────────────────────────────────────────────────────┤
│ CROSS-CUTTING           Business Rules · Guardrails/Safety · Governance ·   │
│                         Caching · Observability/Eval                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Request lifecycle (one turn):**
```
User turn
  → Memory Layer assembles context (history + working slots + profile)
  → Intent Classifier: category, sub-intent, slots, data-need (SQL/RAG/both), safety flag
  → AI Orchestrator plans:
        • missing required slot?  → ask a clarifying question (stop)
        • out-of-scope/unsafe?    → bounded refusal via Response Generator (stop)
        • data known-missing?     → honest "not available yet" (stop)
        • else → dispatch engine(s) with resolved parameters
  → Engine(s) call Retrieval Layer → SQL Layer and/or RAG Layer (grounded evidence + provenance)
  → Engine(s) apply Business Rules / (optionally) LLM reasoning → structured result
  → AI Orchestrator aggregates multi-engine results
  → Response Generator composes grounded NL answer + structured UI payload + citations + follow-ups
  → Memory Layer persists updated slots/decisions
```

**Two worked routes (illustrative):**
- *"Which colleges can I get with rank 9000, BC, and how does counselling work?"* → Intent = **A + G (compound)** → Orchestrator fans out → Prediction Engine (SQL, numeric) **and** Knowledge Engine (RAG, process) → Response Generator merges an eligibility list **plus** a process explanation, each cited to its own source.
- *"Is College X better than College Y for ROI?"* → Intent = **C + E** → Comparison Engine pulls params/placements via SQL → Business Rules detect **`FEES` missing** → verdict is delivered on the dimensions that *do* exist, with an explicit "ROI needs fee data we don't have yet" caveat.

---

## 2. System Components

| # | Component | Plane | One-line role |
|---|---|---|---|
| 3 | **AI Orchestrator** | Orchestration | Plans and coordinates the whole turn |
| 4 | **Intent Classifier** | Orchestration | Understands & routes the question |
| 5 | **Recommendation Engine** | Engine | Judgment: advise / rank *for the student* |
| 6 | **Knowledge Engine** | Engine | Facts (SQL) + concepts/process (RAG) |
| 7 | **Comparison Engine** | Engine | Normalized side-by-side + verdict |
| 8 | **Prediction Engine** | Engine | Deterministic eligibility / "can I get in?" |
| 9 | **Retrieval Layer** | Retrieval | Unified grounding facade over SQL+RAG |
| 10 | **SQL Layer** | Retrieval | Safe, governed access to L1–L5 |
| 11 | **RAG Layer** | Retrieval | Retrieval over curated unstructured KB |
| 12 | **LLM Layer** | Foundation | Model access, tiering, tool-calling |
| 13 | **Prompt Layer** | Foundation | Persona, templates, contracts, guardrails |
| 14 | **Memory Layer** | Conversation | Short/working/long-term context |
| 15 | **Response Generator** | Conversation | Grounded NL + structured answer |

Cross-cutting (not a single box, present throughout): **Business Rules**, **Guardrails/Safety**, **Governance (PII/auth)**, **Caching**, **Observability/Evaluation**.

Each component below is specified with **Purpose · Inputs · Outputs · Responsibilities · Dependencies**.

---

## 3. AI Orchestrator

- **Purpose:** The controller/"brain." Decides *what to do* with a turn — decompose it, gather missing information, select and sequence engines, aggregate results, and hand off to generation. This is where **AI planning** lives.
- **Inputs:** User turn; Intent Classifier's routing decision + slots; assembled context from Memory; capability/availability signals (e.g., which datasets exist).
- **Outputs:** An execution plan (ordered engine calls with parameters), or a short-circuit decision (clarify / refuse / honest-gap); aggregated engine results ready for the Response Generator.
- **Responsibilities:**
  - Slot-completeness check → emit a clarifying question when required slots (rank, category, target college) are missing.
  - Route to one engine or **fan out** to several for compound questions (doc 02 shows many turns mix categories).
  - Enforce ordering/dependencies (e.g., Recommendation calls Prediction first for eligibility).
  - Apply the **honesty gate**: if the intent maps to known-missing data, stop and say so.
  - Own the tool-calling loop, retries, timeouts, and fallbacks (degrade gracefully, never fabricate).
  - Invoke Guardrails before dispatch and before final output.
- **Dependencies:** Intent Classifier, all four Engines, Memory Layer, LLM Layer (for planning reasoning), Prompt Layer, Guardrails, Business Rules.

---

## 4. Intent Classifier

- **Purpose:** Convert a natural-language turn into a structured routing decision using the **doc 02 taxonomy (A–J)** as its label space. This is where **language understanding** happens.
- **Inputs:** User turn; recent conversation context; resolved entities from Memory.
- **Outputs:** `{ category, sub-intent, target engine(s), data-need = SQL | RAG | BOTH, extracted slots, safety/out-of-scope flag, confidence }`.
- **Responsibilities:**
  - Classify into the 10 categories (and compound/multi-intent turns).
  - **Entity/slot extraction & resolution:** rank, cutoff, community/category, college name→ID (fuzzy match to `colleges`/`Cutoff`), branch, district, budget, goal (placement vs research vs proximity).
  - Tag the **data-need profile** so the Orchestrator knows whether to hit SQL, RAG, or both.
  - Flag **out-of-scope/unsafe** (Category J) and **known-missing-data** intents (ROI→`FEES`, dates→`CALENDAR`).
  - Provide confidence so the Orchestrator can choose to clarify when ambiguous.
- **Dependencies:** LLM Layer (a fast, low-cost classification tier), Prompt Layer (label definitions + few-shot exemplars), an entity/alias resolver backed by the SQL Layer for name→ID matching.

---

## 5. Recommendation Engine

- **Purpose:** The **judgment core** — advise the student and produce a *ranked, justified* shortlist tailored to their situation (Category B; ROI variants in E). It answers "which should *I* choose."
- **Inputs:** Student context (rank, category, preferences, constraints, goal) from Memory/slots; candidate universe; selected weighting profile.
- **Outputs:** An ordered recommendation set, each item carrying: eligibility tier, the scoring breakdown, and an LLM-authored **rationale** grounded in the metrics; plus honest caveats for missing dimensions.
- **Responsibilities (pipeline):**
  1. **Eligibility filter** — delegate to the Prediction Engine (never recompute).
  2. **Hard-constraint filter** — Business Rules apply budget (`FEES`, when present), location (`GEO`, when present), branch, college-type.
  3. **Scoring/ranking** — weighted combination over L4 `params` + outcomes (deterministic, configurable weights per goal).
  4. **Rationale generation** — LLM explains *why* each pick fits, citing the numbers behind the score. **Opinion is generated here, over deterministic inputs.**
  5. **Gap handling** — annotate what couldn't be considered (e.g., cost) rather than silently omit.
- **Dependencies:** Prediction Engine, SQL Layer (params/outcomes), Business Rules (weights/constraints/entitlement gating), LLM Layer + Prompt Layer (rationale), Memory (preferences).

---

## 6. Knowledge Engine

- **Purpose:** Answer **facts** and **concepts/process** — the dual-mode information component. It is the explicit place where **SQL-fact vs RAG-concept vs both** is decided at the engine level (Categories D, F facts; G, H concepts/process).
- **Inputs:** Resolved question + entities; the data-need tag from the Classifier.
- **Outputs:** A grounded fact payload (typed values + provenance) and/or a grounded explanation payload (retrieved passages + provenance), ready for composition.
- **Responsibilities:**
  - **Structured-fact path** → SQL Layer: placements, NAAC grade, intake, faculty, location, branch list (single-fact and filtered-list lookups).
  - **Unstructured-concept path** → RAG Layer: "explain counselling," "what is NIRF," policy/eligibility rules, methodology, and **score definitions** (`PowerScore`) that must come from a curated doc.
  - **Both paths** when a turn needs a value *and* its meaning (e.g., "what's College X's PowerScore **and** what does it mean" = SQL value + RAG definition; "explain 7.5% quota **and** who qualifies at my rank" = RAG policy + SQL/Prediction).
  - Compute simple **benchmarks** (e.g., "what's a good placement %") by pairing a SQL-derived distribution with a RAG explanation.
  - Emit explicit "not available" for `FEES`/`CALENDAR`-type factual asks.
- **Dependencies:** SQL Layer, RAG Layer, Retrieval Layer, LLM Layer (only to phrase/summarize retrieved evidence — not to supply facts).

---

## 7. Comparison Engine

- **Purpose:** Produce a normalized, multi-dimensional side-by-side of 2+ colleges/branches and a **grounded verdict** ("which is better, and why") — Category C, and branch-vs-branch like "is AI better than CSE."
- **Inputs:** 2+ resolved entity IDs; optional dimensions of interest (placements, faculty, research, demand, cost); student weighting if personalized.
- **Outputs:** A structured comparison matrix (per-dimension values + per-dimension winner + deltas) and an LLM-authored verdict that cites the matrix; caveats for missing dimensions.
- **Responsibilities:**
  - Fetch each entity's L4 `params` + outcome/faculty/accreditation facts via SQL.
  - **Normalize** to a common frame (units, direction-of-good) so dimensions are comparable.
  - Determine per-dimension winners deterministically; compute the overall verdict via LLM **only after** facts are fixed. **Opinion generation happens here, evidence-first.**
  - Handle branch-level asks honestly where NIRF is institution-grained (`BRANCH-NIRF` gap) and cost where `FEES` is absent.
- **Dependencies:** SQL Layer (params/facts), Business Rules (direction-of-good, weighting), LLM Layer + Prompt Layer (verdict), Memory (personal weighting).

---

## 8. Prediction Engine

- **Purpose:** Deterministically answer "**which college/branch can I get?**" and "**will I get X?**" (Category A) and supply eligibility to the Recommendation Engine. **No LLM in the math.**
- **Inputs:** Rank *or* cutoff mark; community/category; optional branch, district, target college; prediction mode (rank/cutoff).
- **Outputs:** Eligible options with a **risk classification (safe / target / reach)** and, where data allows, probability bands; sorted, typed, provenance-tagged.
- **Responsibilities:**
  - Query **numeric** admissions data — L2 `tnea_ranks`/`tnea_cutoffs` (correctly typed), **not** the text-typed L1 columns (doc 01 data-quality debt). This correctness dependency is architectural.
  - Apply category logic and numeric comparison against closing ranks/marks.
  - Apply **risk-tiering business rules** (threshold bands around the student's number) and trend awareness from multi-year `tnea_*`.
  - Blend demand (`tnea_allotments.fill_rate`) into the risk classification.
  - Emit explicit precision limits (e.g., category-*odds* need `SEAT-MATRIX`; exact future cutoffs are estimates).
- **Dependencies:** SQL Layer (numeric L2), Business Rules (tiers/category), Caching. **Independent of RAG and (for the calculation) of the LLM.**

---

## 9. Retrieval Layer

- **Purpose:** A single **grounding facade** the engines call to "get me evidence for X," hiding whether that evidence is structured (SQL) or unstructured (RAG). Unifies planning, provenance, and caching.
- **Inputs:** A structured retrieval request from an engine (entities, fields/topic, filters, data-need).
- **Outputs:** A normalized evidence bundle: typed rows and/or ranked passages, each tagged with **source, vintage, and confidence** for downstream citation.
- **Responsibilities:**
  - Route each request to SQL Layer, RAG Layer, or both; merge results.
  - Attach **provenance** to every fact/passage (essential for the ground-or-abstain principle).
  - Normalize/shape results into an engine-agnostic contract.
  - Own cross-source caching and freshness policy (e.g., L4 params are already cached upstream, doc 01).
  - Deduplicate/rank when a topic is covered by multiple sources.
- **Dependencies:** SQL Layer, RAG Layer, Caching, Governance (passes auth context through).

---

## 10. SQL Layer

- **Purpose:** Safe, governed, read access to the structured estate (L1–L4 college knowledge; L5 user data for personalization). The factual backbone.
- **Inputs:** A *constrained* query intent from the Retrieval Layer (parameters against a **curated query catalog / semantic layer** — not free-form model-authored SQL); auth context.
- **Outputs:** Typed result sets with provenance (table, columns, vintage).
- **Responsibilities:**
  - Expose a **semantic layer**: vetted, parameterized query templates mapped to question intents (prediction lookup, comparison fetch, factual lookup, filtered exploration, personalized read). This contains blast radius and prevents injection/hallucinated joins.
  - Enforce **numeric correctness** by reading the correctly-typed sources (L2) for prediction, isolating the app's text-typed L1 debt.
  - Handle the `nirf_id ↔ counselling_code ↔ College Code` **bridge** (doc 01) inside vetted joins, so engines never reason about identifier plumbing.
  - Enforce **governance**: read-only, auth-scoped, RLS-respecting; L5 access strictly limited to the authenticated user.
  - Return honest empties (RLS-hidden or absent) distinctly from "no match."
- **Dependencies:** Databases (Supabase/Postgres per doc 01), Governance/auth, Business Rules (for query-catalog definitions), Caching.

---

## 11. RAG Layer

- **Purpose:** Retrieval over a **curated unstructured knowledge base** — process, policy, FAQ, methodology, and score definitions. Serves Categories G/H, which today have **zero corpus** (doc 02 §8–9), so this layer includes the authoring pipeline as an upstream prerequisite.
- **Inputs:** A topic/question + context from the Retrieval Layer.
- **Outputs:** Ranked, **cited** passages with source and vintage.
- **Responsibilities:**
  - Maintain a governed corpus: TNEA counselling process, reservation/eligibility policy, cutoff/tie-break rules, glossary, methodology/trust notes, and definitions for opaque scores.
  - Chunk, index, retrieve, and re-rank for relevance; attach provenance for citation.
  - **Strictly stay in its lane:** RAG supplies *how-things-work* knowledge, **never college facts** (those are SQL) — this separation is the guardrail against the "document Q&A bot" failure mode.
  - Version content with effective dates (esp. `CALENDAR`, which is year-specific).
- **Dependencies:** Knowledge Base authoring/curation (new, must be built), an index/vector store, LLM Layer (for query expansion/re-ranking if used), Governance.

---

## 12. LLM Layer

- **Purpose:** Provider-agnostic access to language models, with **task-appropriate tiering** and tool-calling — the reasoning/generation substrate.
- **Inputs:** Prompts + tool schemas from engines/orchestrator; task type; structured-output contracts.
- **Outputs:** Classifications, plans, reasoned syntheses, verdicts, and natural-language drafts — as structured/tool-call outputs where required.
- **Responsibilities:**
  - **Model tiering by role:** a fast/cheap tier for Intent Classification; a strong reasoning tier for Orchestrator planning, Recommendation rationale, and Comparison verdicts; a balanced tier for general generation. (E.g., an Anthropic Claude Haiku / Sonnet / Opus-class split — selected per task, not globally.)
  - Function/tool-calling, structured outputs, streaming, and retries/fallbacks.
  - Enforce **grounding at the model boundary**: models operate on supplied evidence; they are instructed (via Prompt Layer) not to introduce unsourced facts.
  - Host safety/guardrail model calls where classification of unsafe/out-of-scope is needed.
- **Dependencies:** Prompt Layer, model provider(s), Observability (token/latency/quality telemetry), Guardrails.

---

## 13. Prompt Layer

- **Purpose:** The versioned library of **persona, templates, tool schemas, and contracts** that shape every LLM call. Where the counselor's identity and honesty rules are encoded.
- **Inputs:** Component + task identifiers; assembled evidence and slots; safety context.
- **Outputs:** Fully-formed prompts and output contracts for the LLM Layer.
- **Responsibilities:**
  - Define the **counselor persona** (supportive, unbiased, India/TNEA-aware) and tone.
  - Per-engine templates (classification, planning, recommendation rationale, comparison verdict, response composition).
  - Encode the **grounding & honesty contract**: "use only provided evidence; cite it; if data is missing, say so; never guarantee admission."
  - Hold few-shot exemplars, tool/function schemas, and structured-output specs.
  - Version and A/B prompts; keep safety/guardrail instructions centralized and consistent.
- **Dependencies:** LLM Layer (consumer), Guardrails/Safety policy, Governance (privacy phrasing), Observability (prompt-version telemetry).

---

## 14. Memory Layer

- **Purpose:** Assemble and persist the context that makes it a *counseling conversation*, not stateless Q&A.
- **Inputs:** Conversation turns; resolved slots; authenticated user profile (L5); prior decisions/shortlists.
- **Outputs:** A context bundle for the Orchestrator/Classifier and personalization inputs for the Recommendation Engine.
- **Responsibilities:**
  - **Short-term:** recent dialogue turns.
  - **Working memory:** resolved entities/slots for the session (rank, category, shortlist, goal) so the student isn't re-asked.
  - **Long-term/profile:** preferences and saved lists from L5 (`user_choice_filling_data`, `choice_filling_usage`, plan/entitlement).
  - Context assembly/summarization to stay within model limits.
  - **Strict auth-scoping and privacy** — never surface one user's data to another; honors the doc 01 governance gate (must not read L5 until PII exposure is fixed).
- **Dependencies:** SQL Layer (L5, auth-scoped), Governance, LLM Layer (for summarization), Orchestrator/Recommendation (consumers).

---

## 15. Response Generator

- **Purpose:** Compose the final counselor answer — grounded natural language **plus** UI-renderable structure — from engine outputs and retrieved evidence.
- **Inputs:** Aggregated engine results; retrieved passages; reasoning/verdicts; provenance; safety context.
- **Outputs:** The user-facing message (explanation + recommendation/verdict), structured payloads (comparison tables, eligibility lists, college cards), **citations**, **uncertainty framing**, and suggested follow-ups.
- **Responsibilities:**
  - Blend structured facts and unstructured explanation into one coherent, counselor-toned reply.
  - **Enforce ground-or-abstain at output:** every claim cites its source; missing-data caveats are stated plainly.
  - Attach confidence/uncertainty (esp. predictions and future-cutoff estimates).
  - Render both conversational text and structured UI blocks.
  - Propose next steps ("want me to compare your top 2?") to drive the counseling flow.
- **Dependencies:** LLM Layer + Prompt Layer, all Engines (evidence), Guardrails (final check), Memory (to record what was shown).

---

## 16. Routing — SQL vs RAG vs Both

The Intent Classifier tags each turn; the Orchestrator dispatches accordingly. Traceable to doc 02.

### 16.1 Use **SQL** (structured) — facts, math, filters, eligibility
| Question family (doc 02) | Why SQL | Engine |
|---|---|---|
| Prediction / eligibility (A) | numeric comparison on cutoffs/ranks | Prediction |
| Factual lookup (D) | single measurable attribute | Knowledge (fact path) |
| Exploration / filtered browse (F) | filter + rank over tables | Knowledge (fact path) |
| Comparison facts (C) | fetch normalized metrics per entity | Comparison |
| Financial *numbers* (E) | numeric — *once `FEES` exists* | Recommendation/Comparison |
| Personalized/account (I) | auth-scoped user reads | Memory + Knowledge |

### 16.2 Use **RAG** (unstructured) — process, policy, concepts, definitions
| Question family | Why RAG | Engine |
|---|---|---|
| Process / counselling guidance (G) | explains *how the process works* | Knowledge (concept path) |
| Concept / FAQ (H) | definitions & literacy | Knowledge (concept path) |
| Score/methodology meaning | opaque `PowerScore` needs a curated doc | Knowledge (concept path) |
| "How accurate are predictions?" | trust/methodology narrative | Knowledge (concept path) |

### 16.3 Use **BOTH** — value + meaning, or facts + process
| Question | SQL part | RAG part |
|---|---|---|
| "College X's PowerScore **and** what it means" | the value | the definition |
| "Explain counselling **and** show what I can get" | eligibility list | process explanation |
| "Who qualifies under 7.5% at my rank?" | eligibility compute | policy rule |
| "What's a *good* placement %?" | compute distribution/benchmark | interpret/benchmark narrative |
| "Is fee justified by outcomes?" (future) | outcomes (+ fees) | value-framing context |

**Rule of thumb:** *facts about a college* → SQL; *how the world/process works* → RAG; *a value that also needs explaining, or advice that must cite both* → both. The Recommendation and Comparison engines are SQL-grounded but **add an LLM reasoning step**; they are not RAG.

---

## 17. Where opinion, business rules, and AI reasoning happen

### 17.1 Where **opinion generation** happens
- **Only in the LLM Layer**, invoked by exactly three places, and **always over deterministic evidence**:
  - **Comparison Engine** → the "which is better" verdict (after facts + per-dimension winners are fixed).
  - **Recommendation Engine** → the ranked advice and per-pick rationale (after eligibility + scoring are fixed).
  - **Response Generator** → framing, hedging, and next-step suggestions.
- Opinions are **labeled as judgments**, cite the facts behind them, and never originate in the data or SQL layers. The engines decide *the numbers*; the LLM decides *the narrative about the numbers*.

### 17.2 Where **business rules** execute
- **Deterministically, in engines and the Business Rules component — never in a prompt:**
  - **Prediction Engine:** category logic, numeric comparison, **safe/target/reach thresholds**, demand blending.
  - **Recommendation Engine:** hard constraints (budget/location/branch), **scoring weights** per goal, **entitlement/plan gating** (`choice_filling_usage`, plans).
  - **Comparison Engine:** direction-of-good and dimension weighting.
  - **SQL Layer:** the vetted **query catalog**, identifier-bridge joins, RLS/auth scoping.
- Rules are config/code — **auditable, testable, deterministic**. This keeps admissions logic correct and explainable independent of model behavior.

### 17.3 Where **AI reasoning** happens
- **Understanding:** Intent Classifier (interpretation, slot extraction).
- **Planning:** AI Orchestrator (decomposition, engine selection/sequencing, clarify-vs-answer-vs-refuse).
- **Synthesis/judgment:** Recommendation Engine (trade-off reasoning) and Comparison Engine (verdict) — LLM reasoning **over structured inputs**.
- **Explanation:** Response Generator (grounded natural language).
- In every case the model **reasons over evidence assembled by deterministic components** — it does not retrieve college facts from its parameters.

---

## 18. Grounding & anti-hallucination (how "ground or abstain" is enforced)

- **Provenance everywhere:** the Retrieval Layer tags every fact/passage with source + vintage; the Response Generator must cite them.
- **Evidence-bounded prompts:** the Prompt Layer instructs models to use *only* supplied evidence and to output a "missing data" signal rather than invent.
- **Known-gap register:** the Orchestrator holds the doc 01/02 gap list (`FEES`, `CALENDAR`, `SEAT-MATRIX`, `GEO`, `RECRUITERS`, `BRANCH-NIRF`) and short-circuits or caveats affected intents.
- **Numeric integrity:** prediction/comparison read correctly-typed sources (L2/L4), not the text-typed L1 debt.
- **No-guarantee rule:** admission is always probabilistic; the Prompt Layer forbids guarantees (doc 02 §11).

---

## 19. Governance & Safety plane (cross-cutting)

- **PII/auth:** L5 access is auth-scoped and read-only. **Hard gate:** the anon-readable-PII hole (doc 01 §4) must be closed *before* Memory/Personalization go live.
- **Scope bounding:** Category J (guarantees, other-state counselling, PII requests, exact future predictions, personal/medical/legal) is detected at classification and handled by bounded refusal/redirect in the Response Generator.
- **Guardrails:** pre-dispatch (block unsafe/out-of-scope) and pre-output (block ungrounded/unsafe/over-promising responses).
- **Honesty as a feature:** "I don't have that data yet" is a designed, first-class response, not a failure.

---

## 20. Cross-cutting non-functional concerns

- **Caching:** reuse L4 param computation (already cached, doc 01); cache hot prediction/exploration queries and stable RAG retrievals via the Retrieval Layer.
- **Latency:** favor the fast model tier for classification; the app's scale-to-zero cold-start (noted in QA) argues for a warm serving path for the counselor.
- **Observability:** trace each turn end-to-end (intent → engines → sources → tokens → latency), with prompt/version tagging for the LLM Layer.
- **Evaluation:** a golden-set of doc-02 questions with expected grounding/behavior; measure answer-groundedness, prediction correctness, refusal correctness, and citation coverage — not just fluency.

---

## 21. Buildability & sequencing (architecture-level, ties to doc 02 blockers)

The architecture is stable regardless of gaps; **which engines light up depends on the doc 01/02 blockers**:

| Wave | Deliverable | Prerequisite from doc 01/02 |
|---|---|---|
| **1 — buildable now** | Prediction, Comparison, Knowledge-fact, Exploration, Orchestrator, Intent, SQL Layer, LLM/Prompt/Memory (session), Response Gen | numeric-typing fix; L4 params (exist) |
| **2 — governance-gated** | Personalization/long-term Memory | close L5 PII hole |
| **3 — needs KB** | Knowledge-concept, Process (G), FAQ (H), RAG Layer | author curated KB + `CALENDAR` |
| **4 — needs new data** | ROI/Financial (E), cost in Recommendation/Comparison, category-odds prediction, proximity | `FEES`, `SEAT-MATRIX`, `GEO` |

This lets the counselor ship its strongest capabilities first (structured comparison/prediction/facts) while the missing datasets and knowledge base are built in parallel.

---

## 22. Conclusion

The AI College Counselor is architected as a **deterministic-core, LLM-shell orchestrated agent**: specialized engines (Prediction, Comparison, Recommendation, Knowledge) own facts, numbers, and rules through a governed SQL layer; a curated RAG layer supplies process/policy knowledge only; and the LLM plans, reasons, and explains **over evidence those engines produce** — never from its own memory. SQL is the workhorse, RAG the specialist, and the two meet under an Orchestrator that grounds every claim or honestly abstains.

Critically, the design honors the two prior audits: it exploits CYC's strong structured/`params` knowledge immediately, it isolates the data-quality and identifier debts inside the SQL layer, and it treats the four blockers (`FEES`, knowledge-base/`CALENDAR`, numeric-typing, `SEAT-MATRIX`) as explicit, sequenced prerequisites rather than silent failure modes. The result is a counselor that is accurate where the data is strong, honest where it is missing, and explainable throughout.

*This document defines architecture only — no implementation, code, or prompts. It is the design contract for the build phase.*
