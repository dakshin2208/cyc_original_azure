# AI College Counselor — Recommendation Engine Design (04)

**Project:** ChooseYourCollege (CYC)
**Document type:** Component design — a drill-down into Component #5 of [`03_AI_System_Architecture.md`](./03_AI_System_Architecture.md).
**Builds on:** [`01_Knowledge_Audit.md`](./01_Knowledge_Audit.md) (data + gaps), [`02_Question_Audit.md`](./02_Question_Audit.md) (Category B/E questions), [`03_AI_System_Architecture.md`](./03_AI_System_Architecture.md) (engine boundaries).
**Scope:** Architectural design only — workflow, factor model, ranking, confidence, explainability, evidence, rules, and the AI reasoning boundary. **No code, no formulas-as-code, no schema.**

---

## 0. Purpose & the "explainable, not retrieval" mandate

A retrieval bot answers *"here is College X's placement."* A **counselor** answers *"of the colleges you can actually get, here are the three I'd shortlist for you, ranked, and here is exactly why — and what I couldn't factor in."*

That difference is the entire design. This engine must:
- **Decide, not fetch** — produce a *ranked, filtered, justified* shortlist tailored to one student.
- **Be transparent** — every ranking must decompose into named factor contributions. This is the deliberate opposite of the app's opaque `PowerScore`/`IdleOutputIndex` (doc 01 `SCORE-DEF` gap), which the counselor must *never* present as a reason because it cannot be explained.
- **Separate math from narrative** — deterministic components compute the recommendation and its explanation; the LLM only *verbalizes* that computed explanation (doc 03 §17.1). The LLM cannot alter a score or invent a reason.

**Design principle:** *the number is computed by rules; the story is told by the model, over the number.*

---

## 1. Decision Factor Model

The ten required factors do **not** all play the same role. They separate into three roles, which is the backbone of the whole pipeline:

| Role | Meaning | Factors |
|---|---|---|
| **Gate** (hard, eligibility) | Determines the *feasible set* — you either can or can't get the seat | Cutoff, Community Category |
| **Constraint** (hard or soft filter) | Narrows the feasible set to what the student will accept | Branch Preference, Location Preference (+ budget → `FEES` gap) |
| **Score** (weighted, quality/fit) | Ranks the surviving candidates by desirability | Placement Quality, NIRF Ranking, Faculty Strength, Research, Intake, Historical Allotments |

### 1.1 Factor specification (source-grounded, per doc 01)

| Factor | Role | Source dataset → fields | Direction of good | Normalization | Data confidence / gap |
|---|---|---|---|---|---|
| **Cutoff** | Gate + fit | `tnea_cutoffs` / `Cutoff` → community marks; `tnea_ranks` / `Rank` | closer to student's number = better *fit*; within band = eligible | banded around student value | **Must read numeric L2**, not text-typed L1 (doc 01 debt) |
| **Community Category** | Gate | community columns `OC…ST` (incl. `MBC/MBCV/SCA…`) | n/a (eligibility rule) | categorical | High; category-*odds* need `SEAT-MATRIX` |
| **Branch Preference** | Constraint | `Cutoff`/`colleges` → `Branch Name/Code` | match = keep | binary match / soft bonus | High |
| **Location Preference** | Constraint | `colleges`/`nirf_institutions` → `District`, `State`, `pincode` | match / nearer = better | match or banded | **`GEO`**: only District, no distance |
| **Placement Quality** | Score | `nirf_placement` → `median_salary`, `students_placed`; `params.placement_yield_pct`; `colleges.avgPlacementPercentage` | higher = better | min-max within peer set | Institution-grained (`BRANCH-NIRF`); no `RECRUITERS` |
| **NIRF Ranking** | Score | *(proxy)* `params` composite (`research_score`, faculty, outcomes) + `nirf_accreditation` | higher tier = better | min-max / tier bands | **Gap:** raw NIRF rank number is *not stored* (doc 01 §1.7) — proxied by NIRF-derived quality; ingest actual rank later |
| **Faculty Strength** | Score | `params.faculty` → `phd_pct`, `avg_experience_years`, `total_faculty`, `retention_rate_pct` | higher = better | min-max, sub-weighted blend | Institution-grained (`BRANCH-NIRF`) |
| **Research** | Score | `params.research_score` ← `nirf_ipr`, `nirf_sponsored_research`, `nirf_consultancy`, `nirf_phd_graduated` | higher = better | min-max | Medium; relevant mainly to research-goal students |
| **Intake** | Score (contextual) | `nirf_sanctioned_intake`, `colleges.totalIntake`, `params.intake_current/growth` | context-dependent (scale + growth signal) | min-max + growth band | Institution-grained |
| **Historical Allotments** | Score + risk | `tnea_allotments` → `allotted`, `available`, `fill_rate` (multi-year) | high fill = desirable/competitive; stable = predictable | min-max + volatility band | Best real demand signal; no round-wise movement |

### 1.2 Two things every factor carries
- **Direction-of-good** (is higher better, or is "closer to the student's rank" better) — a Rule Engine setting, never left to the model.
- **Provenance + vintage** — source table and year, so the Explainability Model can cite it and the Confidence score can penalize stale/missing values (doc 03 §18).

---

## 2. Recommendation Workflow

A **funnel**: a large candidate universe is narrowed by gates and constraints, then the survivors are enriched, scored, risk-shaped, and explained. Deterministic stages dominate; the LLM enters only near the end.

```
Student context (rank/cutoff, category, prefs, goal, weights)         [Memory / slots]
        │  (missing critical slot? → clarifying question, stop)
        ▼
① Candidate universe  ─ all branch×college admission units             [SQL Layer]
        ▼
② ELIGIBILITY GATE   ─ Prediction Engine: feasible set + admission     [Prediction Engine]
        │               probability + safe/target/reach tier             (Cutoff, Category, Allotments)
        ▼
③ CONSTRAINT FILTER  ─ hard: branch/location/budget must-haves          [Rule Engine]
        │               soft: preference bonuses (budget = FEES gap → soft only)
        ▼
④ EVIDENCE COLLECTION ─ per candidate: normalized factor values +       [Evidence Collector → Retrieval/SQL]
        │                provenance + vintage + imputation flags          (bridges counselling_code ↔ nirf_id)
        ▼
⑤ SCORING            ─ transparent weighted composite over factors      [Ranking Algorithm + Rule Engine weights]
        ▼
⑥ PORTFOLIO SHAPING  ─ diversify safe/target/reach; dedup; entitlement  [Rule Engine]
        │               cap (plan / choice_filling limit)
        ▼
⑦ CONFIDENCE SCORING ─ per-recommendation trust score + caveats         [Confidence Scorer]
        ▼
⑧ AI REASONING       ─ rationale per pick + portfolio narrative,        [AI Reasoning Layer → LLM]
        │               trade-offs, follow-ups — grounded on ④⑤⑦
        ▼
⑨ EXPLAINABILITY     ─ factor contributions, why-this/why-not,          [Explainability Assembler]
        │               citations, missing-data disclosures
        ▼
Ranked, explained shortlist  →  Response Generator
```

**Key ordering rule:** eligibility (②) and constraints (③) run **before** scoring — never recommend a seat the student can't get or won't accept, regardless of how "good" it scores. Scoring only ever ranks *survivors*.

---

## 3. Evidence Collection

- **Purpose:** Assemble, for every surviving candidate, a normalized **evidence record** that scoring, confidence, and explainability all consume from one place.
- **Inputs:** Feasible+filtered candidate set (IDs); the factor model; student context.
- **Outputs:** Per candidate, a set of `{ factor → raw value, normalized value, source table, vintage, confidence, imputed? }` records.
- **Responsibilities:**
  - **Batch** retrieval for the whole set (avoid per-candidate round-trips).
  - Resolve the **identifier bridge** — join TNEA admission data (`counselling_code`) with NIRF quality data (`nirf_id`) via the L1 bridge (doc 01). A candidate with **no NIRF link** returns quality factors as *missing*, not zero.
  - **Normalize within the peer set** (context-relative min-max) so "good placement" means good *among the colleges this student can actually get* — not against the national max.
  - Tag **vintage** and **imputation**: mark any neutral-imputed value so it is never rewarded and its uncertainty flows to Confidence.
  - Distinguish **"missing/RLS-hidden"** from **"genuinely zero"** (doc 01) — they mean different things for a recommendation.
- **Dependencies:** Retrieval Layer → SQL Layer (L1–L4), Rule Engine (normalization/direction config).

*Why it's its own component:* scoring quality is capped by evidence quality. Centralizing collection guarantees scoring, confidence, and explanations all reason over the **same** provenance-tagged facts.

---

## 4. Rule Engine

The deterministic home of all policy and logic — **never a prompt** (doc 03 §17.2). Config-driven, versioned, auditable, testable.

| Rule class | What it governs | Examples |
|---|---|---|
| **Eligibility rules** | who qualifies for a seat | category→column mapping; numeric cutoff/rank comparison; branch availability |
| **Hard constraints** | non-negotiable filters | must-have branch; in-state only; budget ceiling (when `FEES` exists) |
| **Direction-of-good** | how each factor is oriented | higher salary = better; closer cutoff = better fit |
| **Normalization policy** | how raw values become comparable | peer-set min-max; volatility banding for allotments |
| **Weight profiles** | goal → factor weights | placement-focused / research-focused / balanced / proximity / safety (see §7) |
| **Risk tiering** | safe/target/reach thresholds | bands around the student's rank; demand (`fill_rate`) blending |
| **Portfolio rules** | shape of the final list | minimum N "safe," cap on "reach," diversity across colleges |
| **Entitlement gating** | product limits | list size vs plan / `choice_filling_usage.max_choices` |
| **Missing-data policy** | how gaps are handled | impute-neutral + confidence penalty; certain factors mandatory-else-caveat; **never fabricate** |
| **Fairness/ethics** | trust guarantees | no admission guarantees; category logic applied transparently; no bias amplification |

**Design intent:** an admissions counselor's rules must be *correct and inspectable*. Encoding them here (not in model weights or prompts) makes them changeable by a domain expert and verifiable in tests — independent of LLM behavior.

---

## 5. Ranking Algorithm

A **two-phase** model: a gate, then a transparent weighted composite over the *eligible* set.

### 5.1 Phase A — Eligibility gate (from the Prediction Engine)
Binary/probabilistic feasibility per candidate, plus a **risk tier** (safe / target / reach) derived from where the student's rank sits relative to the multi-year closing band and demand (`fill_rate`). Ineligible candidates leave the funnel here.

### 5.2 Phase B — Transparent composite score (eligible set only)
Conceptually (design notation, **not code**):

```
FitScore(candidate) =
      Σ  weight_factor × normalized_value_factor           ← quality/desirability (the 6 score factors)
   +  PreferenceBonus(branch match, location match)         ← alignment to stated prefs
   +  AdmissionFitBonus(rank sits well within band)         ← appropriate, not wild over-reach
   −  UncertaintyPenalty(imputed / stale / missing factors) ← don't reward absent data
```

**Properties that make it a *counselor's* score, not a black box:**
- **Decomposable:** every candidate's score is the sum of named, signed factor contributions → directly feeds Explainability (§8).
- **Peer-relative normalization:** factors are scaled within the student's feasible set, so ranking answers "best *for you, among your options*."
- **Direction-aware:** each factor oriented by the Rule Engine (higher-better vs closer-better).
- **Missing-data-safe:** neutral imputation + an explicit penalty ensures a data-rich college is never beaten by a data-poor one merely because gaps were scored as zero or ignored.
- **Goal-adaptive weights:** the weight vector comes from the active weight profile (§7), optionally adjusted by the student via the AI Reasoning Layer (which re-runs this deterministic step — the model never edits the score itself).

### 5.3 Tie-breaking (deterministic order)
1) higher Confidence (§6) → 2) more stable historical demand → 3) safer admission tier → 4) stronger placement. All inspectable.

### 5.4 Explicitly *not* used
The app's `PowerScore`/`IdleOutputIndex`/`careerOutcome` are **excluded** as ranking inputs because they are undefined (doc 01 `SCORE-DEF`). If ever surfaced, they appear as *context*, clearly labeled "provider score," never as a driver of a recommendation the counselor must justify.

---

## 6. Confidence Scoring

Confidence answers a different question than admission probability, and **both are surfaced**:

| Signal | Question it answers | Owner |
|---|---|---|
| **Admission probability** | "How likely am I to get this seat?" | Prediction Engine (rank vs band + demand) |
| **Recommendation confidence** | "How much should you trust this recommendation?" | this component |

**Recommendation confidence combines:**
- **Admission certainty** — safe tier → high; reach → low.
- **Data completeness** — share of factors with *real* (non-imputed) values for this candidate. A no-NIRF-link college (admissions-only) scores lower confidence because its quality factors are absent.
- **Data recency** — penalizes stale vintages (`YEAR@L1`, shallow NIRF history).
- **Score separation** — how clearly this candidate ranks vs its neighbors (a near-tie lowers confidence in the *ordering*).
- **Bridge completeness** — whether `counselling_code ↔ nirf_id` resolved cleanly.

**Uses of confidence:** it (a) attaches a trust badge per recommendation, (b) triggers explicit caveats in the explanation, (c) can demote a high-scoring-but-low-confidence pick, and (d) tells the AI Reasoning Layer how strongly to phrase advice ("strong match" vs "worth a look, but I have limited data").

---

## 7. Weight / Goal Profiles

Weights are **presets by student goal**, tunable, guard-railed by the Rule Engine. They make the same factor model serve different students.

| Profile | Placement | NIRF(proxy) | Faculty | Research | Intake | Allotments/Demand | When chosen |
|---|---|---|---|---|---|---|---|
| **Balanced** (default) | ●●● | ●●● | ●● | ●● | ● | ●● | no strong goal stated |
| **Placement-focused** | ●●●●● | ●● | ●● | ● | ● | ●● | "best job outcomes" |
| **Research-focused** | ● | ●●● | ●●● | ●●●●● | ● | ● | "want to do research / MS/PhD" |
| **Reputation-focused** | ●● | ●●●●● | ●●● | ●●● | ● | ●●● | "best-known/top college" |
| **Proximity-focused** | ●● | ●● | ●● | ● | ● | ●● + location hard-weighted | "near home" |
| **Safety-focused** | ●● | ●● | ●● | ● | ● | ●●●● (stable, high fill) | risk-averse / low rank |

The **active profile is disclosed** to the student ("I'm ranking these with a placement lens") — global explainability. The student can re-weight ("I care more about faculty"), which the AI Reasoning Layer translates into a new weight vector and **re-runs deterministic scoring**.

---

## 8. Explainability Model

Every recommendation ships with a **decomposable explanation** — the deliverable that makes this a counselor. Two layers:

### 8.1 Deterministic explanation (computed, not generated)
- **Factor contribution breakdown:** the signed contribution of each factor to the score (which drivers pushed it up/down).
- **Why-this:** top positive contributors ("₹9.2L median salary — top quartile of your options; 78% fill rate — stable demand").
- **Why-not-higher / caution:** top negatives and risks ("research score below peers; reach-tier admission").
- **Admission framing:** safe/target/reach + its basis (rank vs closing band).
- **Relative rationale:** why it ranks above/below neighbors ("above College Y: stronger placement, despite lower research").
- **Citations:** source table + vintage per factor value (doc 03 §18).
- **Missing-data disclosures:** what could not be considered ("cost not factored — no fee data"; "faculty data unavailable — no NIRF link").

### 8.2 Narrative layer (LLM verbalizes the deterministic explanation)
The AI Reasoning Layer turns the structured explanation into counselor-toned prose. **Hard constraint:** it may only restate/organize the computed contributions and caveats — it cannot introduce a reason that isn't in the deterministic breakdown. This is what prevents "plausible but fabricated" justifications.

### 8.3 Global explainability
The active weight profile and the factor set are exposed, so the student understands the *lens*, not just the verdict — and can change it.

---

## 9. AI Reasoning Layer

The LLM's **bounded** role inside this engine (doc 03 §17.1/§17.3). It reasons *over* deterministic artifacts; it does not compute or fetch facts.

- **Purpose:** Convert structured evidence, scores, contributions, and confidence into human counseling — and manage the conversational judgment around it.
- **Inputs:** Evidence records (§3), factor contributions + scores (§5), risk tiers (§2), confidence (§6), student context, active weight profile.
- **Outputs:** Per-pick rationale, an overall portfolio narrative ("2 safe, 2 target, 1 aspirational — here's the logic"), trade-off explanations, clarifying questions, and *proposed* weight adjustments from natural-language preferences.
- **Responsibilities:**
  - **Verbalize** the deterministic explanation faithfully (no invented reasons).
  - **Explain trade-offs** ("better college vs better branch") using the computed contributions.
  - **Translate preferences → weights** ("I care about placement") → hand a new weight vector to the Rule Engine → **re-run deterministic scoring** (the model proposes; the engine recomputes).
  - **Elicit missing slots** and phrase **honest gaps** ("I can't compare ROI — we don't have fee data").
  - **Calibrate tone to confidence** (§6) — confident where data is strong, hedged where thin.
- **Hard boundaries:** cannot change a score, re-order results outside the deterministic tie-break, mark an ineligible college eligible, or state a fact without provenance. Opinions are generated **here**, but always as verbalization of computed evidence.
- **Dependencies:** LLM Layer + Prompt Layer (doc 03 §12–13), and read-only access to the deterministic artifacts of §3/§5/§6.

---

## 10. Worked Example (illustrative walk-through)

**Student:** rank ~9,000, community **BC**, wants **CSE**, prefers **near Coimbatore**, goal **placement**.

1. **Context/slots:** rank, category, branch=CSE (soft), location=Coimbatore district (soft), profile=Placement-focused. All critical slots present → no clarifying question.
2. **Eligibility gate:** Prediction Engine returns CSE + adjacent branches whose BC closing rank ≥ ~9,000 across the feasible colleges, each tagged safe/target/reach from multi-year `tnea_ranks` + `fill_rate`.
3. **Constraint filter:** CSE match gets a preference bonus (not a hard cut, so strong nearby non-CSE options can still surface as alternatives); Coimbatore-district gets a location bonus. Budget → *skipped with a caveat* (`FEES` gap).
4. **Evidence collection:** for each survivor, gather placement (`median_salary`, yield), NIRF-proxy quality, faculty, research, intake, allotment demand — bridging `counselling_code → nirf_id`; two colleges have no NIRF link → quality factors flagged missing.
5. **Scoring:** Placement-focused weights dominate; peer-relative normalization; the two no-NIRF colleges take an uncertainty penalty.
6. **Portfolio shaping:** ensure ≥2 safe options; cap reaches at 1–2; trim to entitlement limit.
7. **Confidence:** NIRF-linked, high-fill, recent-data picks get high confidence; the admissions-only pair get lower confidence + a caveat.
8. **AI reasoning + explainability:** "**#1 (safe): College A – CSE.** Median salary ₹8.9L (top of your eligible set), 82% 5-yr fill (stable, you're comfortably inside the band). Ranked above College B for placement, though B has stronger research — which matters less given your placement goal. Note: I couldn't factor tuition (no fee data), and College D's faculty data is unavailable."
9. **Output:** ranked, tiered, cited shortlist + narrative → Response Generator.

---

## 11. Data-gap handling & graceful degradation

The engine degrades **honestly** rather than failing or fabricating (doc 02 §11, doc 03 §18):

| Gap (doc 01/02) | Effect on engine | Graceful behavior |
|---|---|---|
| **`FEES`** | ROI/budget factor unavailable | drop budget constraint; **state "cost not considered"**; block pure-ROI ranking |
| **`GEO`** (distance) | location = District only | match at district granularity; caveat "proximity approximate" |
| **NIRF-RANK** (raw rank absent) | no literal ranking factor | proxy via NIRF-derived quality; label as proxy; ingest later |
| **`BRANCH-NIRF`** | quality is institution-level | attribute quality to college, not branch; disclose |
| **No NIRF link** for a college | quality factors missing | neutral-impute + confidence penalty; disclose |
| **`SEAT-MATRIX`** | category *odds* imprecise | give tier (safe/target/reach), not false precision |
| **`YEAR@L1` / thin history** | weak trend/volatility | lower confidence; avoid over-claiming trends |
| **numeric-as-text (L1)** | wrong comparisons | read numeric L2 for gating (hard requirement) |

---

## 12. Anti-patterns explicitly avoided

- **Opaque scoring** — no undefined `PowerScore` as a recommendation driver; every score decomposes.
- **Hallucinated reasons** — the LLM verbalizes only computed contributions; it cannot invent justifications.
- **Recommending the ineligible** — gates run before scoring; a great college the student can't get is never top-ranked (may appear only as a labeled "aspirational reach").
- **Rewarding missing data** — neutral imputation + penalty, never a zero that flatters or a blank that inflates.
- **Silent gaps** — omitted factors (cost, distance) are disclosed, not hidden.
- **False precision** — probabilistic framing and confidence, never guarantees.
- **Rules in the prompt** — admissions logic lives in the auditable Rule Engine.

---

## 13. Interfaces (summary)

- **Inputs:** student context/slots (Memory); candidate universe (SQL); weight profile (Rule Engine); Prediction Engine eligibility+tiers.
- **Outputs:** ranked, tiered shortlist; per-pick score breakdown, confidence, citations, caveats; portfolio narrative; optional re-weight proposal — all to the Response Generator.
- **Dependencies:** Prediction Engine (§2), Evidence Collector → Retrieval/SQL Layer (§3), Rule Engine (§4), Ranking (§5), Confidence Scorer (§6), AI Reasoning Layer → LLM/Prompt (§9), Governance (auth-scoped student data).

---

## 14. Conclusion

The Recommendation Engine is deliberately built as a **transparent, rule-governed funnel with an LLM narration layer** — not an information retriever and not a black box. Gates and constraints (Cutoff, Category, Branch, Location) decide *what is even possible*; a **decomposable weighted score** over six quality factors (Placement, NIRF-proxy, Faculty, Research, Intake, Allotments) decides *what is best for this student*; a **confidence model** decides *how much to trust it*; and a **bounded AI reasoning layer** turns the computed contributions into honest, counselor-grade explanations — disclosing, never hiding, the `FEES`/`GEO`/`SEAT-MATRIX`/NIRF-rank gaps inherited from the audits.

Every recommendation can therefore answer the only question that matters to a student: **"why this one — for me?"** — with a reason the system actually computed, not one it made up.

*Architecture only — no code, prompts, or implementation. This is the design contract for building Component #5.*
