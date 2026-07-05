# AI College Counselor — Question Audit (02)

**Project:** ChooseYourCollege (CYC)
**Document type:** Question Audit — *the master catalog of every question a student may ask, classified against CYC's actual knowledge base.*
**Builds on:** [`01_Knowledge_Audit.md`](./01_Knowledge_Audit.md). Every "Required Datasets / Fields / Answerable / Missing" cell is grounded in the datasets inventoried there — not assumed.
**Scope:** Question identification, classification, and coverage analysis only. **No implementation, prompts, embeddings, or retrieval design.** This document is the design contract the AI system will be built against.

---

## 0. How to read this document

Each question is classified against the 12 required attributes. To keep the tables scannable, flag attributes use a legend; the descriptive attributes (Intent, Datasets, Fields, Missing) are in-cell.

**Legend**

| Flag | Meaning |
|---|---|
| **Struct** | Needs *structured* data (SQL tables) — Y/N |
| **Unstr** | Needs *unstructured* data (docs, rules, reviews) — Y/N |
| **SQL** | A database query is required — Y/N |
| **RAG** | Retrieval over unstructured/text knowledge required — Y/N |
| **Rec** | Requires recommendation/judgment (ranking, advice, opinion) — Y/N |
| **Ans** | Answerable with *current* data: ✅ Yes · 🟡 Partial · ❌ No |
| **Conf** | Confidence of a correct answer today: **H**igh / **M**edium / **L**ow |

**Dataset shorthand** (see doc 01 for full schemas): `colleges`, `Cutoff`, `Rank` (L1 product) · `tnea_cutoffs/ranks/allotments` (L2) · `nirf_*` (L3, e.g. `nirf_placement`, `nirf_faculty`, `nirf_accreditation`) · `params` (L4 `/api/college-parameters`) · `user_*` (L5).

**Recurring "Missing Data" tokens** (from doc 01 §4): `FEES` (no fee/scholarship dataset), `CALENDAR` (no counselling dates), `SEAT-MATRIX` (no category-wise seat counts), `RECRUITERS` (no company-level placement), `BRANCH-NIRF` (NIRF is institution-grained), `GEO` (no coordinates/distance), `REVIEWS` (no sentiment), `YEAR@L1` (no time dimension in product tables), `SCORE-DEF` (opaque `PowerScore`).

---

## 1. Question Taxonomy (categories)

| # | Category | Core student question | Dominant capability |
|---|---|---|---|
| A | **Prediction / Eligibility** | "Which college/branch can I get?" | SQL + numeric logic |
| B | **Recommendation / Advisory** | "Which should I choose *for me*?" | SQL + Recommendation |
| C | **Comparison** | "Which is better, A or B?" | SQL + Recommendation |
| D | **Knowledge / Factual** | "What is X about college Y?" | SQL lookup |
| E | **ROI / Financial** | "Is it worth the money?" | SQL + Recommendation (**blocked by FEES**) |
| F | **Exploration / Discovery** | "Show me colleges that…" | SQL filter/rank |
| G | **Process / Counselling Guidance** | "How does counselling work?" | RAG (**blocked by CALENDAR**) |
| H | **General FAQs / Concept** | "What does cutoff mean?" | RAG |
| I | **Personalized / Account** | "What did I save / how many uses left?" | SQL over `user_*` |
| J | **Out-of-Scope / Safety** | (guarantees, other states, personal opinions) | Refuse / bound |

---

## 2. Category A — Prediction / Eligibility

*Intent family: "Given my rank/cutoff and category, what can I realistically get?"*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Which college can I get with cutoff 185, BC? | Match seats to score | `Cutoff`/`tnea_cutoffs` | community marks `OC..ST`, `Branch/College Code`, `District` | Y | N | Y | N | 🟡 | 🟡 | M | `SEAT-MATRIX`, `YEAR@L1`; numeric-as-text fix |
| Which branch can I get at college X with rank 12000? | Branch feasibility at one college | `Rank`/`tnea_ranks` | `College Code`, `Branch`, community ranks | Y | N | Y | N | N | ✅ | H | — |
| Will I get CSE at college X (rank 8000, OC)? | Yes/no eligibility | `Rank`/`tnea_ranks` | `College Code`, `Branch Name`, `OC` | Y | N | Y | N | N | ✅ | H | — |
| Safe / target / reach colleges for my rank? | Risk-tiered list | `Rank`, `tnea_allotments` | ranks by community, `fill_rate` | Y | N | Y | N | Y | 🟡 | M | risk model = judgment; `YEAR@L1` |
| Colleges I can get *and* that have good placements | Eligibility + quality filter | `Rank` + `params`/`nirf_placement` | ranks, `median_salary`, `placement_yield_pct` | Y | N | Y | N | Y | 🟡 | M | `BRANCH-NIRF` (placement is institution-level) |
| What was last year's closing rank for branch B? | Historical cutoff lookup | `tnea_ranks`/`tnea_cutoffs` | `year`, community ranks | Y | N | Y | N | N | ✅ | H | — |
| Is this branch getting more competitive each year? | Trend read | `tnea_cutoffs` (multi-year) | `year`, `OC..ST` | Y | N | Y | N | 🟡 | ✅ | H | — |
| My rank improved — what extra options open up? | Delta exploration | `Rank` | community ranks | Y | N | Y | N | Y | ✅ | H | — |
| Chance of upgrade in later rounds? | Probabilistic movement | `tnea_allotments` | `allotted`, `available`, round data | Y | N | Y | N | Y | ❌ | L | round-wise movement not stored |

**Category note:** the core "can I get in?" is CYC's strongest capability, **but** community cutoff/rank columns are text-typed in L1 (doc 01) — prediction must run on numeric L2 (`tnea_*`) or a fixed L1 to be trustworthy. Category-*odds* (not just yes/no) need `SEAT-MATRIX`.

---

## 3. Category B — Recommendation / Advisory

*Intent family: "Decide for me / advise me," requires judgment beyond lookup.*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Which branch should I choose? | Branch guidance | `params`, `tnea_allotments`, `nirf_placement` | `demand_quality_index`, `median_salary`, `fill_rate` | Y | N | Y | N | Y | 🟡 | M | student interests/aptitude not captured; `BRANCH-NIRF` |
| Which college is best for me? | Personalized pick | `params`, `Rank`, `colleges` | eligibility + `research_score`/`PowerScore`/outcomes | Y | N | Y | N | Y | 🟡 | M | preferences, `FEES`, `GEO`, `SCORE-DEF` |
| Best college for CSE within my reach? | Constrained recommendation | `Rank` + `params` | ranks, outcome params | Y | N | Y | N | Y | 🟡 | M | `BRANCH-NIRF` |
| Should I pick a better college or a better branch? | Trade-off advice | `colleges`, `Cutoff`, `params` | outcomes, cutoffs, `research_score` | Y | N | Y | N | Y | 🟡 | M | judgment-heavy; no student-values input |
| Recommend colleges near my city under my rank | Geo-constrained rec | `Rank`, `colleges` | `District`, ranks | Y | N | Y | N | Y | 🟡 | M | `GEO` (only District, no distance) |
| Best colleges for research / higher studies | Goal-aligned rec | `params`, `nirf_*research`, `nirf_placement` | `research_score`, `phd_output`, `students_higher_studies` | Y | N | Y | N | Y | ✅ | H | — |
| Best ROI college I can get into | Value-optimized rec | `params`, `nirf_placement`, **FEES** | `median_salary` + fees | Y | N | Y | N | Y | ❌ | L | **`FEES`** (ROI impossible without cost) |
| Which college for a girl student / safety & diversity? | Inclusion-aware rec | `nirf_student_strength`, `nirf_institutions` | `female_students`, `pcs_*`, hostel | Y | N | Y | N | Y | 🟡 | M | safety/hostel data absent |
| Rank my choice-filling list optimally | Order optimization | `Rank`, `tnea_allotments`, `params` | ranks, `fill_rate`, outcomes | Y | N | Y | N | Y | 🟡 | M | `SEAT-MATRIX`, upgrade model |

**Category note:** every question here needs a **recommendation layer over SQL results**; none is a pure lookup. The dominant blocker is *the student side of the equation* — CYC has no captured interests/budget/constraints, and `FEES`/`GEO` gaps cap several high-value asks.

---

## 4. Category C — Comparison

*Intent family: "A vs B — which wins, and why?"*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Compare college A and college B | Side-by-side | `colleges`, `params` | outcomes, all 7 param sections | Y | N | Y | N | Y | ✅ | H | `FEES` for cost row |
| Is AI better than CSE (at college X)? | Branch vs branch | `Cutoff`/`Rank`, `nirf_placement` | branch cutoffs, outcomes | Y | N | Y | N | Y | 🟡 | M | `BRANCH-NIRF` (branch-level outcomes weak) |
| Which of these 3 has better placements? | Outcome compare | `nirf_placement`, `params` | `median_salary`, `placement_yield_pct` | Y | N | Y | N | Y | ✅ | H | `RECRUITERS` for depth |
| Which has better faculty? | Faculty compare | `nirf_faculty`, `params` | `phd_pct`, `avg_experience_years` | Y | N | Y | N | Y | ✅ | H | — |
| Which is better value for money? | Cost-benefit compare | `params`, **FEES** | outcomes + fees | Y | N | Y | N | Y | ❌ | L | **`FEES`** |
| Which has better research output? | Research compare | `params`, `nirf_ipr/research/consultancy` | `research_score`, `patents_per_100_faculty` | Y | N | Y | N | Y | ✅ | H | — |
| Which is more competitive to get into? | Demand compare | `tnea_allotments`, `tnea_cutoffs` | `fill_rate`, cutoffs | Y | N | Y | N | Y | ✅ | H | — |
| Government vs private college for my rank? | Type compare | `colleges`, `Rank`, **FEES** | type flag, ranks, fees | Y | N | Y | N | Y | 🟡 | M | college *type* not explicit; `FEES` |
| Compare campus/hostel/facilities | Facility compare | `nirf_financial_capital`, `nirf_sdg_*` | capital spend, green/accessibility | Y | N | Y | N | Y | 🟡 | M | no facility inventory; `REVIEWS` |

**Category note:** comparison is a **strong suit** because L4 `params` is pre-normalized and explainable — the AI can compare *and justify*. The only systemic gap is the cost dimension (`FEES`) and branch-level attribution.

---

## 5. Category D — Knowledge / Factual (single-fact lookup)

*Intent family: "Tell me one fact about a college."*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| What are the placements at college X? | Outcome fact | `nirf_placement`, `colleges` | `median_salary`, `students_placed` | Y | N | Y | N | N | ✅ | H | `RECRUITERS`, branch split |
| What's the median salary? | Salary fact | `nirf_placement` | `median_salary` | Y | N | Y | N | N | ✅ | H | distribution absent |
| What's the NAAC grade? | Accreditation fact | `nirf_accreditation` | `body`, `grade_or_score`, `valid_to` | Y | N | Y | N | N | ✅ | H | NBA/branch accreditation |
| How many seats / what's the intake? | Capacity fact | `nirf_sanctioned_intake`, `colleges` | `sanctioned_intake`, `totalIntake` | Y | N | Y | N | N | 🟡 | M | `SEAT-MATRIX` (per-category) |
| How many faculty / PhD %? | Faculty fact | `nirf_faculty`, `params` | `total_faculty`, `phd_pct` | Y | N | Y | N | N | ✅ | H | — |
| Where is the college located? | Location fact | `colleges`, `nirf_institutions` | `District`, `State`, `pincode` | Y | N | Y | N | N | 🟡 | M | `GEO` (no address/coords) |
| What branches does college X offer? | Program list | `Cutoff`/`colleges` | `Branch Name/Code` | Y | N | Y | N | N | ✅ | H | — |
| What's the fee? | Cost fact | **FEES** | tuition, hostel | Y | N | Y | N | N | ❌ | L | **`FEES`** |
| Is it autonomous / university-affiliated? | Status fact | `nirf_institutions` | `nirf_category` | Y | N | Y | N | N | 🟡 | M | autonomy/affiliation not explicit |
| What's the male:female / diversity ratio? | Composition fact | `nirf_student_strength` | gender, state mix | Y | N | Y | N | N | ✅ | H | — |
| Student-to-faculty ratio? | Ratio fact | `nirf_faculty`, `nirf_student_strength` | `total_faculty`, `total_students` | Y | N | Y | N | N | ✅ | H | — |
| What's the PowerScore and what does it mean? | Score fact + meaning | `colleges` | `PowerScore` | Y | Y | Y | Y | N | 🟡 | M | **`SCORE-DEF`** (opaque; needs doc) |

**Category note:** factual lookup is the **highest-confidence category** and mostly pure SQL. Note the last row: any "what does this score mean?" needs a *definition document* (RAG) because `PowerScore`/`IdleOutputIndex` are undocumented.

---

## 6. Category E — ROI / Financial

*Intent family: "Is it worth the cost?" — the category most blocked by missing data.*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Which college has the best ROI? | Value ranking | **FEES** + `nirf_placement` | fees, `median_salary` | Y | N | Y | N | Y | ❌ | L | **`FEES`** |
| What will 4 years cost me here? | Total cost | **FEES** | tuition, hostel, per year | Y | N | Y | N | N | ❌ | L | **`FEES`** |
| Cheapest college with decent placement? | Budget-constrained rec | **FEES** + `params` | fees + outcomes | Y | N | Y | N | Y | ❌ | L | **`FEES`** |
| Are scholarships available? | Aid discovery | `nirf_student_strength` (proxy) | `full_fee_reimbursement`, `avgScholarshipPercentage` | Y | N | Y | N | N | 🟡 | L | scholarship *scheme* data absent |
| Salary vs fee payback period? | ROI calc | **FEES** + `nirf_placement` | fees, `median_salary` | Y | N | Y | N | Y | ❌ | L | **`FEES`** |
| Is the fee justified by outcomes? | Value judgment | **FEES** + `params` | fees, outcome params | Y | N | Y | N | Y | ❌ | L | **`FEES`** |

**Category note:** **This entire category is effectively unanswerable today.** CYC has institutional *expenditure* (`nirf_financial_*`) but **no student-facing fee data**. `FEES` is the single highest-leverage missing dataset (doc 01, P0). Until added, the counselor should *explicitly decline* ROI questions rather than guess.

---

## 7. Category F — Exploration / Discovery

*Intent family: "Show me colleges matching a filter," open-ended browse.*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| List colleges in Chennai | Location filter | `colleges` | `District` | Y | N | Y | N | N | ✅ | H | — |
| Colleges offering AI / Data Science | Program filter | `Cutoff` | `Branch Name` | Y | N | Y | N | N | ✅ | H | — |
| Top 10 colleges by placement | Ranked browse | `nirf_placement`, `params` | `median_salary`, `placement_yield_pct` | Y | N | Y | N | 🟡 | ✅ | H | — |
| Top research-focused colleges | Ranked browse | `params` | `research_score` | Y | N | Y | N | 🟡 | ✅ | H | — |
| Colleges with NAAC A+ | Attribute filter | `nirf_accreditation` | `grade_or_score` | Y | N | Y | N | N | ✅ | H | — |
| Colleges with high female diversity | Composition filter | `nirf_student_strength` | `female_students` | Y | N | Y | N | N | ✅ | H | — |
| Greenest / most accessible campuses | Niche filter | `nirf_sdg_*`, `nirf_institutions` | `green_campus_score`, `pcs_*` | Y | N | Y | N | 🟡 | 🟡 | M | `sdg_quantitative` latent/unused |
| Colleges within X km of my home | Proximity browse | `colleges` | `District`, `pincode` | Y | N | Y | N | N | ❌ | L | **`GEO`** |
| Newest / fastest-growing colleges | Growth browse | `nirf_sanctioned_intake`, `params` | `intake_growth_pct` | Y | N | Y | N | 🟡 | ✅ | H | — |
| Colleges good for a specific career (e.g. GATE/PSU) | Outcome-goal browse | `nirf_placement` | `students_higher_studies` | Y | N | Y | N | Y | 🟡 | M | career-path tagging absent |

**Category note:** exploration is well-served by structured filtering; the only hard blocker is proximity (`GEO`). Ranked browses double as light recommendations.

---

## 8. Category G — Process / Counselling Guidance

*Intent family: "How does the admission process work?" — this is where RAG (not SQL) dominates.*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Explain how TNEA counselling works | Process explainer | *(process docs)* | — | N | Y | N | Y | N | ❌ | L | **process knowledge base absent** |
| What are the important dates this year? | Timeline | **CALENDAR** | round dates, deadlines | Y | Y | Y | Y | N | ❌ | L | **`CALENDAR`** |
| How does choice filling work? | Feature/process explainer | *(product + process docs)* | — | N | Y | N | Y | N | ❌ | L | needs curated content |
| What documents do I need? | Checklist | *(process docs)* | — | N | Y | N | Y | N | ❌ | L | not in data |
| How is the tie-break / cutoff computed? | Rule explainer | *(TNEA rules)* | — | N | Y | N | Y | N | ❌ | L | rules KB absent |
| What is 7.5% reservation / how do categories work? | Policy explainer | *(policy docs)* | — | N | Y | N | Y | N | ❌ | L | policy KB absent |
| What happens if I miss a round? | Contingency guidance | *(process docs)* | — | N | Y | N | Y | Y | ❌ | L | process KB absent |
| How many choices can I fill? | Product rule | `choice_filling_usage`, `plans` | `max_choices`, plan | Y | Y | Y | N | N | 🟡 | M | product rules partly in code |

**Category note:** **This is the biggest architectural signal in the audit.** These questions are *unstructured* and need a curated **process/policy/FAQ knowledge base (RAG)** plus a **CALENDAR** dataset — neither exists today. CYC's data estate is almost entirely structured; the counselor cannot explain *process* until a text knowledge base is authored. This, with `FEES`, defines the two must-build foundations.

---

## 9. Category H — General FAQs / Concept

*Intent family: "Explain a concept" (domain literacy, not college-specific).*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| What does "cutoff" mean? | Concept | *(FAQ KB)* | — | N | Y | N | Y | N | ❌ | L | FAQ KB absent |
| Difference between rank and cutoff? | Concept | *(FAQ KB)* | — | N | Y | N | Y | N | ❌ | L | FAQ KB absent |
| What is NIRF / NAAC? | Concept | *(FAQ KB)* + `nirf_accreditation` | — | N | Y | N | Y | N | ❌ | L | FAQ KB absent |
| What is a good salary/placement %? | Benchmark concept | `params` (for benchmarks) | outcome distributions | Y | Y | Y | Y | Y | 🟡 | M | needs curated benchmarks |
| Is CSE a good branch generally? | Opinion/concept | *(FAQ KB)* + `nirf_placement` | branch outcomes | Y | Y | Y | Y | Y | 🟡 | M | subjective; needs guardrails |
| How accurate are these predictions? | Meta/trust | *(product docs)* | — | N | Y | N | Y | N | ❌ | L | needs honest methodology doc |

**Category note:** concept FAQs are RAG-only and currently unsupported (no FAQ corpus). Some can blend a curated benchmark computed from `params` (structured) with an explanation (unstructured).

---

## 10. Category I — Personalized / Account

*Intent family: "About me and my usage" — reads L5, gated by auth & privacy.*

| Question | User Intent | Datasets | Required Fields | Struct | Unstr | SQL | RAG | Rec | Ans | Conf | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| What colleges did I save? | Recall saved list | `user_choice_filling_data` | user's saved choices | Y | N | Y | N | N | ✅ | H | — (must be auth-scoped) |
| How many choice-fills do I have left? | Entitlement | `choice_filling_usage`, `plans` | `usage_count`, `max_choices` | Y | N | Y | N | N | ✅ | H | — |
| Continue where I left off / my last session | Session recall | `choice_filling_logs` | activity events | Y | N | Y | N | N | 🟡 | M | log completeness |
| Based on my saved list, what should I add? | Personalized rec | `user_choice_filling_data` + `Rank`/`params` | saved list + eligibility | Y | N | Y | N | Y | 🟡 | M | preference signal thin |

**Category note:** answerable and high-value, **but every query must be strictly scoped to the authenticated user.** Doc 01 flagged L5 PII as anon-readable — this category must **not** be built until that governance hole is closed.

---

## 11. Category J — Out-of-Scope / Safety (must be bounded, not answered)

*The master doc must define what the counselor refuses or redirects — this is a design requirement, not a gap.*

| Question | Why bounded | Correct behavior |
|---|---|---|
| "Guarantee I'll get college X." | No system can guarantee allotment | Refuse guarantee; give probabilistic framing |
| "Which college gives the easiest degree / bribe / backdoor?" | Unethical | Refuse |
| Questions about NEET/medical, other states' counselling (JEE/JoSAA, KCET…) | Out of TNEA scope/data | State scope limits; redirect |
| "Give me another student's data / contact." | PII request | Refuse (ties to L5 governance) |
| "Predict 2026 cutoffs exactly." | Future data doesn't exist | Offer trend-based *estimate* with uncertainty |
| Personal/medical/legal advice | Not a counselor's remit | Redirect to appropriate authority |
| Anything the data can't support (e.g., ROI without FEES) | Avoid hallucination | **Explicitly say "I don't have that data yet"** |

**Category note:** the honesty boundary — *"I don't have fee/calendar/process data yet"* — is itself a first-class design requirement so the AI degrades gracefully instead of fabricating.

---

## 12. Synthesis — Capability & Coverage Analysis

### 12.1 Coverage snapshot (by category)

| Category | Mostly answerable now? | Primary capability | Primary blocker |
|---|---|---|---|
| A Prediction | 🟡 Yes (with numeric fix) | SQL + logic | numeric-as-text, `SEAT-MATRIX` |
| B Recommendation | 🟡 Partial | SQL + Rec | student prefs, `FEES`, `GEO` |
| C Comparison | ✅ Strong | SQL + Rec | `FEES`, `BRANCH-NIRF` |
| D Knowledge | ✅ Strong | SQL lookup | `FEES`, `SCORE-DEF` |
| E ROI/Financial | ❌ Blocked | SQL + Rec | **`FEES`** |
| F Exploration | ✅ Strong | SQL filter | `GEO` |
| G Process | ❌ Blocked | RAG | **KB + `CALENDAR`** |
| H FAQ/Concept | ❌ Blocked | RAG | **FAQ KB** |
| I Personalized | ✅ Yes (gated) | SQL over `user_*` | governance (PII) |
| J Out-of-scope | n/a (bound) | refusal logic | — |

### 12.2 What the current data answers *well* (build these first)
Comparison (C), Factual lookup (D), Exploration (F), core Eligibility (A), and gated Personalization (I) — all sit on structured data + the pre-normalized L4 `params`, which is **explainable** and thus safe for an AI to reason over.

### 12.3 The four blockers that gate the most questions
Ranked by number of high-value questions they unlock (cross-referenced to doc 01's P0/P1 recommendations):

1. **`FEES` dataset** → unlocks *all of E* + the cost dimension of B, C, D. **Highest leverage.**
2. **Process/FAQ/policy knowledge base + `CALENDAR`** → unlocks *all of G and H* — the entire "explain it to me" surface, which today has **zero** support.
3. **Numeric typing fix on cutoff/rank** → makes *A and prediction inside B* trustworthy (correctness, not just coverage).
4. **`SEAT-MATRIX` (category-wise seats)** → turns A from "yes/no" into "what are my *odds*," and sharpens B's list-ordering.

Secondary: `GEO` (proximity in B/D/F), `BRANCH-NIRF` (branch-level truth in B/C), `RECRUITERS` (placement depth in C/D), `SCORE-DEF` (explainability in D), `REVIEWS` (experience in C/F).

### 12.4 Capability-mix implication (data contract, not implementation)
- **SQL is the workhorse:** categories A, C, D, E, F, I are structured-first. A robust structured query capability covers ~70% of question *volume*.
- **RAG is mandatory but currently starved:** categories G and H are entirely unstructured and have **no corpus** — a curated knowledge base is a prerequisite, not an enhancement.
- **Recommendation/judgment** overlays B, C, and parts of A/E/F — it consumes SQL results; it does not replace them.
- **Refusal/uncertainty handling** (J, plus every ❌/🟡 above) is a required capability so the counselor stays honest where data is missing.

### 12.5 Intent → data-need matrix (one-line contract)
```
Lookup a fact          → SQL(1 table)                         → D, I
Predict eligibility    → SQL(cutoff/rank, numeric)            → A
Filter/rank a set      → SQL(filter+order over params)        → F, parts of B/C
Compare entities       → SQL(N rows) + judgment               → C
Advise / decide        → SQL + recommendation + student prefs → B, ROI(E)
Explain a process/term → RAG(curated KB)                      → G, H
Personal/account       → SQL(user_*, auth-scoped)             → I
Unsupported/unsafe      → refuse / bound / state-limits        → J + all ❌
```

---

## 13. Conclusion — how this doc drives the design

The Question Audit shows CYC can, **today**, credibly answer **comparison, factual, exploration, eligibility, and (gated) personalization** questions — because those ride on structured data and the explainable L4 parameter layer. It **cannot yet** answer **ROI/financial** or **process/FAQ** questions at all — the two categories students arguably ask most — because `FEES`, a `CALENDAR`, and a curated **knowledge base** simply do not exist in the estate.

Therefore the master design must treat three things as non-negotiable inputs, in priority order:
1. A **structured-query capability** over L1/L2/L3/L4 (covers the answerable majority) — *with the numeric-typing correctness fix from doc 01*.
2. A **curated unstructured knowledge base** (process, policy, FAQ, score definitions) — without it, categories G/H and every "what does this mean?" fail.
3. An **honesty/uncertainty boundary** that says *"I don't have that data yet"* for `FEES`/`CALENDAR`/`SEAT-MATRIX`/`GEO` — so the counselor never fabricates the very things it lacks.

Everything downstream (routing, retrieval, recommendation, and conversation design) should be specified against this catalog. This document deliberately stops at *what to answer and whether the data supports it* — it makes no implementation decisions.
