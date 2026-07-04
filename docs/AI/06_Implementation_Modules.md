# AI College Counselor — Implementation Module Breakdown (06)

**Project:** ChooseYourCollege (CYC) — existing production Next.js 14 (App Router, standalone, Supabase, Azure Container Apps).
**Document type:** Implementation design — converts the architecture (docs 03–05) into independent, buildable modules integrated into the existing codebase.
**Builds on:** [`01`](./01_Knowledge_Audit.md)–[`05`](./05_Reasoning_Engine.md). **This document does not redesign the architecture** — it maps it to modules.
**Scope:** Module breakdown only — **no code.** Interfaces are described as named operations (contracts), not implementations.

---

## 0. Integration principles (how the AI fits the existing app)

1. **Framework-agnostic core.** All AI logic lives under **`lib/ai/`** as plain TypeScript modules with no Next.js coupling — so each module is unit-testable in isolation and portable off Next if ever needed.
2. **Thin HTTP edge.** The frontend talks to a small set of route handlers under **`app/api/ai/`** that do nothing but auth, stream, and delegate to the **AI Gateway**. No business logic in routes (matches the existing `app/api/*` convention but keeps these thin).
3. **Reuse, don't rebuild.** The **Prediction** and **SQL** modules wrap existing assets — `lib/parameters.ts` (the L4 engine), `lib/college-service.ts`, `lib/college-data.ts`, `lib/supabase.ts` — rather than re-deriving them.
4. **Independent modules, explicit contracts.** Modules depend only on the **`shared/`** contracts, never on each other's internals. This is what makes the breakdown "independent."
5. **Governance is a gate, not a step.** The doc 01 §4 PII exposure (anon-readable `profiles`) **must be closed before Memory/Profile modules read user data** (RLS + auth-scoping). Flagged per-module.
6. **Deterministic core / LLM shell preserved.** Engines and rules are deterministic; the LLM is reached only through the **LLM Client** and shaped only by the **Prompt** module (docs 03–05).

---

## 1. Top-level folder structure

```
lib/ai/
├── shared/                 # contracts, types, errors, ids, result envelopes  (foundational)
├── llm/                    # LLM client + model tiering                        (foundational)
├── rules/                  # business rules, weight profiles, gap register     (foundational)
├── prompt/                 # persona, templates, output contracts              (Prompt Module)
├── guardrails/             # safety, scope, PII/governance checks              (foundational)
│
├── retrieval/              # Retrieval Module (facade over sql + rag)
│   ├── sql/                # SQL Module (semantic layer / query catalog)
│   └── rag/                # RAG Module (curated KB retrieval)
│
├── engines/
│   ├── prediction/         # Prediction Module (wraps lib/parameters + tnea_*)
│   ├── knowledge/          # Knowledge Module (SQL-fact + RAG-concept)
│   ├── comparison/         # Comparison Module
│   └── recommendation/     # Recommendation Module (doc 04)
│
├── intent/                 # Intent Module
├── memory/                 # Memory Module
├── profile/                # Student Profile Module
├── planner/                # Planner Module
├── reasoning/              # Reasoning Module (deliberation core, doc 05)
├── response/               # Response Generator
├── gateway/                # AI Gateway (entry + orchestrator runtime)
│
├── evaluation/             # Evaluation Module
├── monitoring/             # Monitoring Module
└── logging/                # Conversation Logger

app/api/ai/
├── chat/route.ts           # streaming entry → Gateway
├── feedback/route.ts       # thumbs / correction capture → Logger/Eval
└── health/route.ts         # readiness for the counselor path

components/counselor/        # chat UI (client components)
supabase/ai/                 # new tables + RLS policies (memory, profile, logs, eval, KB index)
```

---

## 2. Module → architecture → existing-code map

| Module | Realizes (doc) | Reuses existing |
|---|---|---|
| AI Gateway | Orchestrator runtime (03 §3) | `app/api/*` patterns, auth via `lib/supabase` |
| Intent | Intent Classifier (03 §4, 05 §3) | — |
| Memory | Memory Layer (03 §14) | Supabase (new tables) |
| Student Profile | Profile Reasoning (05 §5) | Supabase, `user_choice_filling_data` |
| Planner | Planning Layer (05 §6) | — |
| Reasoning | Reasoning Engine (05) | — |
| Recommendation | Recommendation Engine (04) | `lib/parameters`, `lib/college-service` |
| Knowledge | Knowledge Engine (03 §6) | `lib/parameters`, `lib/college-data` |
| Comparison | Comparison Engine (03 §7) | `lib/parameters` |
| Prediction | Prediction Engine (03 §8) | **`tnea_*` tables**, `lib/parameters` |
| Retrieval | Retrieval Layer (03 §9) | — |
| SQL | SQL Layer (03 §10) | `lib/supabase`, `lib/parameters`, `lib/college-service` |
| RAG | RAG Layer (03 §11) | new KB corpus (doc 02 gap) |
| Prompt | Prompt Layer (03 §13) | — |
| Response Generator | 03 §15 | existing UI components |
| Evaluation | 03 §20 | — |
| Monitoring | 03 §20 | existing logging conventions |
| Conversation Logger | governance/audit (03 §19) | Supabase |

---

## 3. Module specifications

Each module below: **Purpose · Responsibilities · Inputs · Outputs · Folder structure · Dependencies · Public interfaces · Internal components · Implementation order.** Interfaces are named operations (contracts), not code.

---

### 3.1 AI Gateway
- **Purpose:** The single entry point and runtime host for a counselor turn — the executable form of the Orchestrator's *execution-controller* role (doc 05: mechanism, not mind).
- **Responsibilities:** Authenticate & rate-limit; open a streaming channel; assemble the turn envelope (user, session, message); invoke the Reasoning Module; run the tool-calling/error/timeout loop; enforce pre- and post-guardrails; stream partial results; write telemetry & logs.
- **Inputs:** HTTP request (authenticated user, session id, message); config.
- **Outputs:** Streamed response chunks + final structured payload; telemetry events.
- **Folder structure:** `gateway/` → `turn-orchestrator`, `stream`, `guards`, `errors`, `index`.
- **Dependencies:** Reasoning, Guardrails, Response Generator, Monitoring, Logging, shared, llm (indirectly).
- **Public interfaces:** `handleTurn(request) → stream<ResponseChunk>`; `abortTurn(turnId)`.
- **Internal components:** turn envelope builder; orchestration loop; stream manager; error/fallback policy.
- **Implementation order:** **Wave 2** (needs Reasoning + Response present).

### 3.2 Intent Module
- **Purpose:** Convert an utterance into a structured routing decision using the doc 02 taxonomy (stage ① of doc 05).
- **Responsibilities:** Classify category/sub-intent; infer hidden intent; extract & resolve entities (rank, category, college→id, branch, district, budget, goal); tag data-need (SQL/RAG/both); flag out-of-scope/unsafe; emit confidence.
- **Inputs:** User turn; recent context; profile snapshot.
- **Outputs:** `IntentResult { category, subIntent, engines, dataNeed, slots, safetyFlag, confidence }`.
- **Folder structure:** `intent/` → `classifier`, `entity-resolver`, `taxonomy`, `index`.
- **Dependencies:** LLM Client (fast tier), Prompt, SQL (for name→id resolution), shared.
- **Public interfaces:** `classify(turn, context, profile) → IntentResult`.
- **Internal components:** intent classifier; slot/entity extractor; alias/fuzzy college resolver; safety pre-screen.
- **Implementation order:** **Wave 2.**

### 3.3 Memory Module
- **Purpose:** Persist and assemble conversation state — short-term dialogue, working slots, and the asked/answered log (doc 03 §14, doc 05 §5.3).
- **Responsibilities:** Store/retrieve turns; maintain working memory; summarize to fit context; enforce **auth-scoping**; expose the asked-log that guarantees "never ask twice."
- **Inputs:** Turn events; slot updates; user/session ids.
- **Outputs:** Assembled `ConversationContext`; asked/answered ledger.
- **Folder structure:** `memory/` → `store` (Supabase adapter), `context-assembler`, `summarizer`, `asked-log`, `index`.
- **Dependencies:** SQL/Supabase, LLM Client (summarization), Guardrails (privacy), shared.
- **Public interfaces:** `loadContext(userId, sessionId) → ConversationContext`; `appendTurn(...)`; `recordAsked(slot)`; `wasAsked(slot) → bool`.
- **Internal components:** persistence adapter; window/summarization policy; ledger.
- **Implementation order:** **Wave 2**, **governance-gated** (RLS must be fixed first).

### 3.4 Student Profile Module
- **Purpose:** Build/maintain the provenance-aware student slot model across the conversation (doc 05 §5).
- **Responsibilities:** Merge stated/inferred/defaulted slots with confidence; propagate inferences (goal→weights); handle contradictions and invalidate dependent conclusions; expose completeness for slot-gap detection.
- **Inputs:** Extracted slots (Intent); prior profile; L5 signals (`user_choice_filling_data`, plan).
- **Outputs:** `StudentProfile { slot → {value, source, confidence, ts, mutable} }`; completeness report.
- **Folder structure:** `profile/` → `slot-model`, `merge-policy`, `inference`, `completeness`, `index`.
- **Dependencies:** Memory, SQL (L5, auth-scoped), Rules (defaults/inference config), shared.
- **Public interfaces:** `resolveProfile(userId, sessionId) → StudentProfile`; `applySlots(profile, slots) → StudentProfile`; `missingFor(mode, profile) → Slot[]`.
- **Internal components:** slot merger; inference rules; contradiction handler; completeness checker.
- **Implementation order:** **Wave 2**, **governance-gated.**

### 3.5 Planner Module
- **Purpose:** Turn (intent + profile + data-need) into an execution plan — which engines/retrieval, alone or together, and in what order (doc 05 §6).
- **Responsibilities:** Select reasoning mode(s); map mode→engine plan; check preconditions (slots, entity existence, dataset availability); decide single vs fan-out; sequence dependencies (Prediction→Recommendation, SQL→Comparison); route to clarification/abstention when preconditions fail.
- **Inputs:** IntentResult; StudentProfile; gap register; capability registry.
- **Outputs:** `ExecutionPlan { steps[], mode(s), evidenceContract }` or a `Clarify`/`Abstain` directive.
- **Folder structure:** `planner/` → `mode-selector`, `plan-builder`, `precondition-checks`, `mode-engine-map`, `index`.
- **Dependencies:** Rules (mode→plan policy, gap register), LLM Client (novel/compound planning), shared.
- **Public interfaces:** `plan(intent, profile) → ExecutionPlan | Directive`.
- **Internal components:** deterministic policy table; LLM planner fallback; precondition validators.
- **Implementation order:** **Wave 2.**

### 3.6 Reasoning Module
- **Purpose:** The deliberation core (doc 05) — drives evidence collection, validation/conflict detection, the Facts→Opinion decision chain, confidence, explanation planning, and abstention.
- **Responsibilities:** Execute the plan via engines; validate evidence (provenance/freshness/relevance/sufficiency); detect conflicts; run the Decision Layer (no opinion without evidence); compute composite confidence; assemble the explanation object; own the failure/abstention decision.
- **Inputs:** ExecutionPlan; engine outputs; profile; context.
- **Outputs:** `Decision { answer/verdict/ranking, evidenceGraph, confidence, explanation, gaps }` or `Abstention`.
- **Folder structure:** `reasoning/` → `evidence-validator`, `conflict-detector`, `decision-layer`, `confidence`, `explanation-planner`, `failure-handler`, `index`.
- **Dependencies:** all four Engines, Retrieval, Rules, Guardrails, shared. (LLM only via engines/Response for narration.)
- **Public interfaces:** `reason(plan, profile, context) → Decision | Abstention`.
- **Internal components:** evidence validator; conflict resolver; decision/opinion builder; confidence composer; explanation assembler; abstention policy.
- **Implementation order:** **Wave 2** (the keystone; integrates Wave-1 engines).

### 3.7 Recommendation Module
- **Purpose:** Ranked, explainable shortlists (doc 04) — the judgment engine.
- **Responsibilities:** Eligibility gate (delegate to Prediction) → constraint filter → evidence collection → transparent weighted scoring → portfolio shaping → per-pick rationale inputs; expose factor contributions & confidence.
- **Inputs:** StudentProfile (rank, category, prefs, goal, weights); candidate universe.
- **Outputs:** `Recommendations { ranked[], perItem: {score, contributions, tier, confidence, citations, caveats} }`.
- **Folder structure:** `engines/recommendation/` → `eligibility-adapter`, `constraint-filter`, `evidence-collector`, `scorer`, `portfolio`, `explain`, `index`.
- **Dependencies:** Prediction, SQL/Retrieval, Rules (weights/constraints/entitlement), shared.
- **Public interfaces:** `recommend(profile, options) → Recommendations`.
- **Internal components:** the doc 04 funnel stages as sub-components.
- **Implementation order:** **Wave 3** (needs Prediction + SQL; consumed by Reasoning).

### 3.8 Knowledge Module
- **Purpose:** Facts (SQL) + concepts/process (RAG) — the dual-mode information engine (doc 03 §6).
- **Responsibilities:** Route fact vs concept vs both; fetch structured facts; retrieve cited explanations; compute simple benchmarks; emit "not available" on gapped facts.
- **Inputs:** Resolved question + entities + data-need.
- **Outputs:** `KnowledgeResult { facts[], passages[], provenance }`.
- **Folder structure:** `engines/knowledge/` → `fact-path`, `concept-path`, `benchmark`, `index`.
- **Dependencies:** SQL, RAG, Retrieval, LLM (phrasing only), shared.
- **Public interfaces:** `answerFact(query) → Facts`; `explain(topic) → Passages`; `answer(query) → KnowledgeResult`.
- **Internal components:** fact resolver; concept retriever; benchmark computer.
- **Implementation order:** **Wave 1** (fact path) / **Wave 4** (concept path, needs RAG).

### 3.9 Comparison Module
- **Purpose:** Normalized side-by-side + grounded verdict (doc 03 §7).
- **Responsibilities:** Fetch each entity's params/facts; normalize to a common frame; compute per-dimension winners deterministically; prepare verdict inputs; disclose missing dimensions (`FEES`, `BRANCH-NIRF`).
- **Inputs:** 2+ resolved entity ids; dimensions; optional weights.
- **Outputs:** `ComparisonMatrix { dimensions[], perEntityValues, winners, deltas, gaps }`.
- **Folder structure:** `engines/comparison/` → `fetch`, `normalize`, `scorer`, `verdict-input`, `index`.
- **Dependencies:** SQL/Retrieval, Rules (direction-of-good), shared.
- **Public interfaces:** `compare(entityIds, dimensions, weights?) → ComparisonMatrix`.
- **Internal components:** multi-entity fetcher; normalizer; per-dimension evaluator.
- **Implementation order:** **Wave 1.**

### 3.10 Prediction Module
- **Purpose:** Deterministic eligibility / "can I get in?" (doc 03 §8) — the gate other engines depend on.
- **Responsibilities:** Query **numeric L2** (`tnea_ranks`/`tnea_cutoffs`) — *not* text-typed L1 (doc 01 debt); apply category logic + numeric comparison; risk-tier (safe/target/reach) with `tnea_allotments` demand; expose precision limits.
- **Inputs:** rank or cutoff; community; optional branch/district/college; mode.
- **Outputs:** `EligibilityResult { options[], perOption: {tier, probabilityBand}, limits }`.
- **Folder structure:** `engines/prediction/` → `query`, `category-logic`, `risk-tiering`, `index`.
- **Dependencies:** SQL (numeric L2), Rules (tiers), `lib/parameters` (context), shared.
- **Public interfaces:** `predict(input) → EligibilityResult`; `isEligible(college, branch, input) → verdict`.
- **Internal components:** numeric matcher; tier classifier; demand blender.
- **Implementation order:** **Wave 1** (highest priority — everything downstream depends on it).

### 3.11 Retrieval Module
- **Purpose:** Unified grounding facade over SQL + RAG (doc 03 §9).
- **Responsibilities:** Route retrieval requests; merge structured+unstructured results; attach provenance/vintage/confidence; dedupe/rank; own cross-source caching.
- **Inputs:** `RetrievalRequest { entities, fields/topic, filters, dataNeed }`.
- **Outputs:** `EvidenceBundle { rows[], passages[], provenance }`.
- **Folder structure:** `retrieval/` → `router`, `merge`, `provenance`, `cache`, `index` (+ `sql/`, `rag/`).
- **Dependencies:** SQL, RAG, Monitoring, shared.
- **Public interfaces:** `retrieve(request) → EvidenceBundle`.
- **Internal components:** source router; result merger; provenance tagger; cache.
- **Implementation order:** **Wave 1.**

### 3.12 SQL Module
- **Purpose:** Safe, governed, semantic access to L1–L5 (doc 03 §10) — the factual backbone.
- **Responsibilities:** Expose a **query catalog** (vetted, parameterized templates per question intent — no free-form model SQL); enforce numeric-correct sources; hide the `counselling_code ↔ nirf_id ↔ College Code` bridge inside vetted joins; enforce read-only, auth-scoped, RLS-respecting access; distinguish empty-vs-missing.
- **Inputs:** `QueryIntent { name, params, authContext }`.
- **Outputs:** typed result sets + provenance.
- **Folder structure:** `retrieval/sql/` → `catalog` (named queries), `bridge` (identifier joins), `client` (Supabase), `governance`, `index`.
- **Dependencies:** `lib/supabase`, `lib/parameters`, `lib/college-service`, Rules, Guardrails, shared.
- **Public interfaces:** `run(queryIntent) → ResultSet`; catalog registry of named queries.
- **Internal components:** query catalog; identifier-bridge joins; RLS/auth enforcer; type mappers.
- **Implementation order:** **Wave 0/1** (foundational; wrap existing `lib/parameters`).

### 3.13 RAG Module
- **Purpose:** Retrieval over the **curated** unstructured KB (doc 03 §11) — process, policy, FAQ, methodology, score definitions.
- **Responsibilities:** Maintain a governed corpus (**must be authored** — doc 02 gap); chunk/index/retrieve/re-rank; attach citations + effective dates; **stay in lane** (never college facts — those are SQL).
- **Inputs:** topic/question + context.
- **Outputs:** ranked cited passages.
- **Folder structure:** `retrieval/rag/` → `corpus` (authored content), `index` (vector/keyword store adapter), `retriever`, `reranker`, `citations`.
- **Dependencies:** an index/vector store, LLM (optional re-rank/expansion), Governance, shared. **Upstream: KB authoring pipeline.**
- **Public interfaces:** `search(topic, context) → Passages`.
- **Internal components:** corpus loader; indexer; retriever; re-ranker; citation builder.
- **Implementation order:** **Wave 4** (blocked on curated corpus + `CALENDAR`).

### 3.14 Prompt Module
- **Purpose:** Versioned persona, templates, tool schemas, output contracts (doc 03 §13) — where counselor identity and the honesty contract live.
- **Responsibilities:** Provide per-task templates (classify, plan, recommend rationale, comparison verdict, response compose); encode grounding/honesty/no-guarantee rules; hold exemplars & structured-output specs; version + A/B.
- **Inputs:** task id; assembled evidence/slots; safety context.
- **Outputs:** fully-formed prompt + output contract for the LLM Client.
- **Folder structure:** `prompt/` → `persona`, `templates/`, `contracts`, `versions`, `index`.
- **Dependencies:** shared; consumed by LLM Client; aligned with Guardrails.
- **Public interfaces:** `build(taskId, inputs) → PromptSpec`.
- **Internal components:** template registry; contract definitions; version manager.
- **Implementation order:** **Wave 0** (foundational).

### 3.15 Response Generator Module
- **Purpose:** Compose the final grounded counselor answer + structured UI payload (doc 03 §15).
- **Responsibilities:** Blend structured decision + retrieved passages into counselor-toned NL; enforce ground-or-abstain at output (citations, caveats); attach uncertainty; render text + structured blocks (comparison tables, eligibility lists, cards); propose follow-ups.
- **Inputs:** `Decision`/`Abstention` from Reasoning; provenance; safety context.
- **Outputs:** streamed NL + structured `ResponsePayload` + citations + follow-ups.
- **Folder structure:** `response/` → `composer`, `structured-blocks`, `citations`, `followups`, `index`.
- **Dependencies:** LLM Client, Prompt, Guardrails, shared; UI contracts for `components/counselor/`.
- **Public interfaces:** `generate(decision) → stream<ResponseChunk> + ResponsePayload`.
- **Internal components:** narrative composer; block renderer; citation formatter; follow-up suggester.
- **Implementation order:** **Wave 3.**

### 3.16 Evaluation Module
- **Purpose:** Measure answer quality against a golden set (doc 03 §20) — groundedness, prediction correctness, refusal correctness, citation coverage.
- **Responsibilities:** Maintain golden questions (from doc 02) + expected behaviors; run offline/CI evals; score groundedness/accuracy/abstention; regression-gate prompt/rule changes; capture live feedback for eval sets.
- **Inputs:** golden cases; captured turns + feedback.
- **Outputs:** eval reports; regression signals; labeled datasets.
- **Folder structure:** `evaluation/` → `golden-sets`, `scorers`, `runners`, `reports`, `index`.
- **Dependencies:** Gateway (replay), Logging, shared.
- **Public interfaces:** `runSuite(suiteId) → EvalReport`; `scoreTurn(turn, expected) → Scores`.
- **Internal components:** dataset registry; scorers; CI runner.
- **Implementation order:** **Wave 5** (needs an end-to-end path to evaluate).

### 3.17 Monitoring Module
- **Purpose:** Observability across the turn (doc 03 §20) — trace, latency, tokens, quality signals.
- **Responsibilities:** Emit spans (intent→engines→sources→tokens→latency); tag prompt/rule versions; track cost & error rates; surface confidence/abstention rates; alert on drift/cold-start latency (noted in QA).
- **Inputs:** telemetry events from all modules.
- **Outputs:** traces, metrics, alerts, dashboards.
- **Folder structure:** `monitoring/` → `tracing`, `metrics`, `alerts`, `index`.
- **Dependencies:** shared; a metrics/tracing backend adapter.
- **Public interfaces:** `span(name, attrs)`; `metric(name, value)`; `event(...)`.
- **Internal components:** tracer; metrics collector; alert rules.
- **Implementation order:** **Wave 0** skeleton, deepened in **Wave 5**.

### 3.18 Conversation Logger Module
- **Purpose:** Durable, governed record of turns for audit, support, and eval capture (doc 03 §19).
- **Responsibilities:** Persist turns, decisions, evidence provenance, confidence, and outcomes; capture user feedback/corrections; enforce PII/retention policy; feed Evaluation.
- **Inputs:** turn envelopes + decisions + feedback.
- **Outputs:** append-only conversation log; feedback records.
- **Folder structure:** `logging/` → `writer`, `schema`, `feedback`, `retention`, `index`.
- **Dependencies:** Supabase (new tables), Guardrails (PII/retention), shared.
- **Public interfaces:** `logTurn(record)`; `logFeedback(record)`.
- **Internal components:** log writer; feedback capture; retention enforcer.
- **Implementation order:** **Wave 2** (start), analytics in **Wave 5**; **governance-gated.**

---

## 4. Additional foundational modules (implied by the architecture, required for completeness)

These aren't in the prompt's example list but the architecture (docs 03–05) requires them; adding them is not a redesign.

### 4.1 LLM Client Module (`llm/`)
- **Purpose:** Provider-agnostic model access with task-based tiering (doc 03 §12).
- **Responsibilities:** Model routing (fast tier for Intent; strong tier for planning/rationale/verdict; balanced for generation); tool-calling; structured outputs; streaming; retries/fallback; token/latency telemetry.
- **Inputs:** `PromptSpec` + task/tier; tool schemas. **Outputs:** model results (structured/streamed).
- **Public interfaces:** `complete(spec, tier) → result`; `stream(spec, tier) → stream`.
- **Dependencies:** Prompt, Monitoring, shared. **Order:** **Wave 0.**

### 4.2 Rules & Config Module (`rules/`)
- **Purpose:** Deterministic business rules & config home (docs 04 §4, 05) — weight profiles, risk thresholds, mode→engine map, gap register, entitlement rules.
- **Public interfaces:** typed rule/config accessors (versioned). **Dependencies:** shared. **Order:** **Wave 0.**

### 4.3 Guardrails & Governance Module (`guardrails/`)
- **Purpose:** Safety, scope-bounding, and privacy enforcement (doc 03 §19, doc 05 §10).
- **Responsibilities:** Pre-dispatch (block unsafe/out-of-scope), post-output (block ungrounded/over-promising), auth-scoping/PII checks, no-guarantee enforcement.
- **Public interfaces:** `checkInbound(turn)`, `checkOutbound(response)`, `scopeUser(query, auth)`. **Order:** **Wave 0.**

### 4.4 Shared Contracts Module (`shared/`)
- **Purpose:** The typed contracts every module depends on — the seam that keeps modules independent (envelopes, `IntentResult`, `StudentProfile`, `EvidenceBundle`, `Decision`, ids, error types). **Order:** **Wave 0 (first).**

---

## 5. Data & schema additions (Supabase)

New tables under `supabase/ai/` (with **RLS from day one** — governance gate):
- `ai_conversations`, `ai_messages` — turn history (Memory/Logger).
- `ai_student_profiles` — persisted slot model (Profile).
- `ai_feedback` — thumbs/corrections (Logger/Eval).
- `ai_kb_documents` / vector index — RAG corpus (RAG).
- `ai_eval_cases`, `ai_eval_runs` — Evaluation.

All keyed to the authenticated user and **strictly RLS-scoped** — and the pre-existing `profiles`/`user_referrals` anon-read hole (doc 01 §4) must be closed before these go live.

---

## 6. Integration points with the existing app

- **API edge:** `app/api/ai/chat` (stream → Gateway), `.../feedback`, `.../health`. Node runtime (like existing `app/api/college-parameters`); keep out of Edge (Supabase + reasoning need Node).
- **UI:** `components/counselor/` chat surface; can reuse existing design system (`components/ui/*`) and embed structured blocks (comparison tables, eligibility lists) that mirror `components/results-table.tsx`.
- **Reuse map:** Prediction/SQL wrap `lib/parameters.ts` & `tnea_*`; Knowledge/Comparison reuse `lib/parameters` + `lib/college-data`; auth via `lib/supabase`.
- **Deployment:** ships in the same container (doc 03 §20 warm-path note applies — avoid scale-to-zero cold start on the counselor route).

---

## 7. Suggested implementation order (consolidated)

Dependency-driven waves. Each module's own order tag above rolls up to this:

| Wave | Modules | Why here |
|---|---|---|
| **0 — Foundations** | shared → LLM Client, Rules, Prompt, Guardrails, SQL (wrap `lib/parameters`), Monitoring skeleton | contracts + deterministic access everything else needs. **Close the RLS/PII gate here.** |
| **1 — Deterministic engines** | Prediction, Knowledge (fact path), Comparison, Retrieval | testable **without** LLM; Prediction first (gate for all downstream) |
| **2 — Cognition** | Intent, Memory, Profile, Planner, Reasoning, Gateway, Conversation Logger (start) | turns the engines into a *conversation*; **Memory/Profile governance-gated** |
| **3 — Judgment & generation** | Recommendation, Response Generator | full counselor answers with rationale |
| **4 — Knowledge base** | RAG + KB authoring, Knowledge (concept path) | unlocks process/FAQ (doc 02 Categories G/H); needs curated corpus + `CALENDAR` |
| **5 — Quality & ops** | Evaluation, Monitoring (deep), Logger analytics | measure & harden once the path is end-to-end |

**Rationale:** Waves 0–3 deliver a working counselor over CYC's *strong* structured knowledge (prediction, comparison, facts, recommendation) — shippable before the missing datasets/KB exist. Wave 4 adds the unstructured surface once authored. Wave 5 makes it measurable and operable. This mirrors the doc 02/05 blocker sequencing without redesigning anything.

---

## 8. Independence & testing strategy

- **Contract-only coupling:** modules import from `shared/` only; no module reaches into another's internals. This lets each be built, mocked, and tested alone.
- **Deterministic engines are pure:** Prediction/Comparison/SQL are testable with fixtures and **no LLM**, enabling fast, reliable CI (and directly regression-testing the doc 01 numeric-correctness fix).
- **LLM behind one seam:** all model calls go through the LLM Client, so prompts/models can change without touching engines.
- **Evaluation gates change:** prompt/rule edits run the golden suite (doc 02 questions) before merge.

---

## 9. Summary

The AI College Counselor implements as **~22 independent modules under `lib/ai/`**, fronted by thin `app/api/ai/*` routes and a `components/counselor/` UI, reusing the existing `lib/parameters`/`college-service`/`supabase` assets rather than rebuilding them. Every architectural component from docs 03–05 maps to exactly one module; deterministic engines and rules stay pure, the LLM is confined behind a single client shaped only by the Prompt module, and governance/observability are foundational rather than afterthoughts.

Built in six dependency-ordered waves, the system delivers a working counselor over CYC's structured knowledge first (Waves 0–3), then activates the unstructured knowledge base (Wave 4) and operational quality tooling (Wave 5) — integrating cleanly into the running production app **without any change to the architecture** defined in the preceding documents.

*Module breakdown only — no code. This document is the build plan for the AI College Counselor.*
