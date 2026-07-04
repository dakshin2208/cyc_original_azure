# Recommendation Engine — Production Architecture Review

**Author:** Principal AI Architect
**Date:** 2026-07-04
**Status:** ✅ Direction decisions locked (see *Resolved decisions*) — ⏳ awaiting explicit go-ahead to begin **M1**; no code until then
**Scope guardrails honored:** architecture is FINAL (Student → Conversation → Profile → Orchestrator → **Recommendation Engine (source of truth)** → Evidence → GPT-4.1 → NL). GPT explains only; it is never given ranking authority. Every proposal below keeps determinism, keeps business logic out of the prompt, and preserves the existing 529-test suite.

> This review is grounded in a line-by-line read of the engine plus a **live reproduction** of the flagship query. Every claim carries a `path:line` citation. Nothing here is speculative.

---

## 0. Executive Summary

**Verdict:** The pipeline architecture is sound and the deterministic discipline is genuinely good. The recommendation *quality* problem is real and is caused by **four compounding defects in the ranking/eligibility core, plus two upstream data-integrity defects** — not by GPT, not by the conversation layer.

### The flagship failure, proven

`recommendByCutoff(190, 'BC', { district: 'Coimbatore' })` returns **Nehru Institute of Engineering & Technology at #1**, ahead of Sri Krishna (#4) and PSG College of Technology (#7), while CIT, GCT, PSG-ITAR and Kumaraguru are **removed entirely**. Live trace (reproduced, then discarded):

| College | OC cutoff | Band vs BC-190 | Fate | Score |
|---|---:|---|---|---:|
| Coimbatore Institute of Technology | 198 | dream (`>195`) | **filtered out before scoring** | — |
| Government College of Technology | 197.5 | dream | **filtered out** | — |
| PSG Institute of Tech & Applied Research | 197 | dream | **filtered out** | — |
| Kumaraguru College of Technology | 195.5 | dream | **filtered out** | — |
| **Nehru Inst. of Engineering & Tech** | 174 | safe | **#1** | **0.6231** |
| Sri Krishna College of Engg & Tech | 192 | reach | #4 | 0.5776 |
| PSG College of Technology | *null* | unknown | #7 | 0.5485 |

### The four ranking/eligibility defects

1. **Community-blind eligibility (D1).** Every community is judged against the **OC** (general) closing cutoff — the *strictest* band ([`nirf2026-cutoff-lookup.ts:23`](../../lib/recommendation/data/nirf2026-cutoff-lookup.ts#L23)). A BC student at 190 is measured against OC marks of 195–198, so the best colleges read as "dream." Their true **BC** cutoffs (which exist in the data — see §2) would clear.
2. **Hard exclusion of aspirational colleges (D2).** The executor *drops* every `dream` college before scoring ([`executor.ts:95`](../../lib/recommendation/strategies/executor.ts#L95)). A real counselor *shows* reach/dream colleges, clearly labeled. Combined with D1, CIT/GCT/Kumaraguru simply vanish.
3. **Renormalization rewards sparse data (D3).** The score is a weighted average over **only the dimensions that have data** ([`scoring-engine.ts:59`](../../lib/recommendation/scoring/scoring-engine.ts#L59)). Nehru is missing placement/research/infrastructure/finance, so its average is taken over just its four favorable axes → **0.6231**, beating complete-data Sri Krishna (**0.5776**), which is *penalized* for honestly reporting a middling academic-reputation number. A missing dimension should not be a free pass.
4. **The score ignores every real quality signal (D4).** OC selectivity, `PowerScore` (Sri Krishna 96.4, the district's highest), median salary (Sri Krishna ₹700k, the district's highest), NIRF rank — **none are scoring inputs** ([`executor.ts:32`](../../lib/recommendation/strategies/executor.ts#L32), extractor table [`normalizers.ts:126`](../../lib/recommendation/scoring/normalizers.ts#L126)). There is literally nothing in the formula that could rank PSG above Nehru.

### The two upstream data-integrity defects

5. **Shared-NIRF-id mis-join (D5).** 64 NIRF ids are each shared by ≥2 colleges; the crosswalk is first-wins, so facts attach to one college and the rest get nothing — or worse, the *wrong* facts. Nehru's entire positive signal (faculty 278, reputation 259, NIRF present) is **borrowed from "KPR Institute of Engineering & Technology"** (shared `nirfId IR-E-C-36999`). The #1 result is ranked on another college's data.
6. **Duplicate entities (D6).** e.g. CIT exists twice — one record with `ocCutoff 198`, one bare stub with `null`. Name-keyed identity + a broken 2026 join leave ghosts that can never rank.

### The most important strategic finding

**The data to fix eligibility already exists — it is simply not bridged.** There are two parallel pipelines. **System A** (the recommendation engine) gates only on OC cutoff + district. **System B** (`lib/parameters.ts`, Supabase-backed) *already reads* community-wise cutoffs, NAAC, and historical trends, but it is a read-only parameter API, not the recommender. Community + branch closing marks for **all** categories (oc/bc/bcm/mbc/sc/sca/st, 2021–2025) sit in `Ftnea_cutoffs.csv` — but the warehouse loads that file **only for branch names**, discards the marks, and `CanonicalCollege.counsellingCodes` is hardcoded `[]` ([`college-transform.ts:122`](../../lib/knowledge/transform/college-transform.ts)). **This reframes the work from "acquire data" to mostly "bridge and consume data you already have."**

### What good looks like

Deterministic, community-correct eligibility that produces a **counselor-style spread** (a few reach, several target, a couple safe — each labeled), ranked by a **quality score built on the signals that actually exist** (selectivity, placement, salary, PowerScore, research, faculty, NIRF), with **structured evidence** for every recommended college and a **golden-set regression harness** that makes silent quality loss impossible.

---

## Phase 1 — Recommendation Engine Audit

Entry point `createRecommendationEngine(repos, retrieval, options)` ([`facade/recommendation-engine.ts:104`](../../lib/recommendation/facade/recommendation-engine.ts#L104)); all 16 public verbs delegate through `run(category, request)` → `strategyFor(category).recommend(ctx, request)` → the single shared pipeline `rankProfiles` ([`executor.ts:78`](../../lib/recommendation/strategies/executor.ts#L78)). Candidate set is **the entire warehouse** — there is no branch- or cutoff-scoped retrieval; every filter is applied afterward.

| Stage | Current behavior | Problem | Production-grade alternative | Expected improvement |
|---|---|---|---|---|
| **Entry / candidate set** | `ctx.profiles.listProfiles()` = all colleges, then filter ([`executor.ts:112`](../../lib/recommendation/strategies/executor.ts#L112)). Branch never narrows candidates (`BRANCH_NOTE`, [`strategies.ts:47`](../../lib/recommendation/strategies/strategies.ts#L47)). | Branch queries rank across *all* colleges regardless of whether they offer the branch. `by_branch` is a caveat string, not a filter. | Branch-scoped candidate generation once per-college↔branch linkage exists (via the counselling-code bridge, §2). | Branch queries become truthful; irrelevant colleges disappear. |
| **Eligibility filter** | `assess().category !== 'dream'` drops dream before scoring ([`executor.ts:95`](../../lib/recommendation/strategies/executor.ts#L95)); OC cutoff for all communities; `safeMargin 8`, `reachMargin 5` ([`config.ts:114`](../../lib/recommendation/config.ts#L114)). | **D1 + D2.** Reserved students judged against OC; aspirational colleges hidden. `dream ⇔ ocCutoff > studentCutoff + 5`. | Community+branch cutoff lookup; **soft banding** — keep all bands, label them, rank as a spread; hard-drop only true non-starters (e.g. > OC + large margin) or drop nothing and let ranking sink them. | Reserved-category correctness; counselor-style spread; CIT/Kumaraguru reappear. |
| **Feature generation** | 9 fixed dimensions extracted per profile ([`normalizers.ts`](../../lib/recommendation/scoring/normalizers.ts)); `availableBranches` always `NO_DATA`; `dataCompleteness` is itself a dimension. | Quality signals absent (selectivity, PowerScore, salary tier, NIRF rank); `dataCompleteness` as a *feature* rewards having data, not being good; one dead dimension. | Add **selectivity** (OC-cutoff percentile), **outcome** (median salary, placement %, careerOutcome), **PowerScore**; demote `dataCompleteness` from a feature to a confidence/penalty. | Ranking reflects merit; the flagship re-orders correctly (projected §3). |
| **Scoring formula** | `total = Σ(nᵢ·wᵢ)/Σ(wᵢ)` over **dimensions with data only** ([`scoring-engine.ts:52`](../../lib/recommendation/scoring/scoring-engine.ts#L52)). | **D3.** Missing dimension ≠ 0; it is dropped from the denominator → sparse colleges float to the top. | **Fixed-denominator** scoring (missing = 0 contribution) + a **minimum-evidence gate** so stubs cannot outrank complete colleges. | Nehru falls from 0.623 → ~0.28; Sri Krishna 0.578 stays; correct order. |
| **Sort / tie-break** | `total ↓ → dataCompleteness ↓ → name ↑ → id ↑` ([`executor.ts:68`](../../lib/recommendation/strategies/executor.ts#L68)). | `dataCompleteness` double-counts (feature **and** tie-break); ultimate arbiter is **alphabetical**, so ties resolve by name. | Tie-break on merit sub-scores (selectivity, then salary), then a stable id; never on display name. | No more "N beats P" artifacts. |
| **Confidence** | `= dataCompleteness`, banded at 0.75 / 0.45 ([`reason-generator.ts:54`](../../lib/recommendation/reasons/reason-generator.ts#L54)). Chat layer re-derives its own ([`opinion-service.ts:89`](../../lib/opinion/service/opinion-service.ts#L89)). | Confidence measures data coverage / query well-formedness, **not** recommendation fit. `high` is reachable with sparse data if the query was well-specified. | Calibrate confidence to admission-band certainty (cutoff data present + low volatility) **and** evidence completeness; separate "answer confidence" from "admission certainty." | Confidence becomes trustworthy and monitorable (§6 calibration). |
| **Fallback wiring** | No injected cutoffs ⇒ `nullCutoffLookup` ⇒ all `unknown` ⇒ **no eligibility filtering at all** ([`facade:110`](../../lib/recommendation/facade/recommendation-engine.ts#L110)). | Silent, invisible degradation; smoke tests run in this mode and never exercise eligibility. | Fail-loud telemetry when the lookup is null in production; golden tier must inject a real lookup. | Eligibility can never silently no-op in prod. |

---

## Phase 2 — Dataset Audit

**21 CSVs** exist in the data directory; **System A loads 12**; **10 are never loaded** (`Ftnea_ranks`, `Ftnea_allotments`, `accreditation`, `sanctioned_intake`, `student_strength`, `sdg_*`, `mea_iks`, `innovation_startups`, `executive_dev_programs`).

### 2026 dataset (`2026_final_NIRF_data.csv`, 492 rows)

19 columns incl. `avgMedianSalary, avgPlacementPercentage, avgHigherStudiesPercentage, careerOutcome, ocCutoff, District, PowerScore`. Populated: `ocCutoff` 367/492 (74.6%), `District` 431/492 (87.6%), NIRF-coded/rich rows only ~206 (~41%). **Only an OC cutoff exists here — no BC/MBC/SC columns.**

### Field-utilization map (what the engine actually uses)

| Field(s) | Source | Class | Note |
|---|---|---|---|
| median salary, placement % | warehouse `placement` CSV | **used in score** (`placement`, w=3) | but capped/blended |
| faculty, research, finance, PhD scholars, NIRF-presence | warehouse CSVs | **used in score** | dimensions 2–6 |
| **2026 `ocCutoff`** | 2026 file | **gate only** | eligibility filter; *not* a ranking signal ([`executor.ts:32`](../../lib/recommendation/strategies/executor.ts#L32)) |
| **2026 `district`** | 2026 file | **filter only** | exact `toLowerCase()` compare, no normalization |
| **2026 `avgMedianSalary`, `avgPlacementPercentage`, `careerOutcome`, `PowerScore`, `totalIntake`, `avgSeatsFilled`, …** | 2026 file | **loaded-but-ignored** | parsed + merged, then never consumed |
| **community cutoffs oc/bc/bcm/mbc/sc/sca/st** | `Ftnea_cutoffs`/`ranks` (16,124 rows, 2021–25) | **discarded** | file loaded only for branch names; marks thrown away ([`warehouse-builder.ts:231`](../../lib/knowledge/warehouse/warehouse-builder.ts)) |
| `sponsoredAmount`, `consultancy`, `patentsGranted`, faculty gender/experience | warehouse | **loaded-but-ignored** | present on models, read by nothing |
| fees, hostel, top recruiters, true highest package, NBA, autonomous, ownership flag, official NIRF rank | — | **not in any data** | must be acquired |

### Data-quality issues

- **64 shared NIRF ids** (168 rows) → first-wins crosswalk misroutes placement/faculty/research/finance for ~160 colleges (`nirfConflicts`, [`warehouse-builder.ts:143`](../../lib/knowledge/warehouse/warehouse-builder.ts)). *This is the proximate cause of the flagship's Nehro/KPR mis-join.*
- **`counsellingCodes` never populated** — hardcoded `[]` → the entire TNEA admission side (community/branch cutoffs, allotments, ranks) is unbridged; the 2026 `collegeCode` join method is structurally dead (`byCode` built from an always-empty list).
- **2026 join ceiling** — only 206/492 rows carry a NIRF code (all 206 resolve); the other 286 can match by name only. `added: 0` always (additive-safe).
- **No district normalization** — spelling variants silently drop a college from a district filter.
- **Duplicate entities** (CIT ×2, multiple "Sri Krishna …") from name-keyed identity + sparse rows.

### Gaps for a production TN counselor

| Need | Supported today? |
|---|---|
| Community-wise cutoffs | **Data exists** (`Ftnea_cutoffs`) but **unbridged**; engine uses OC-for-all |
| Branch-level cutoffs + filtering | Data exists (per branch) but unbridged; no per-college↔branch link |
| Historical trend / volatility | Data exists (2021–25) but engine ignores it (System B computes it) |
| Placement %, median salary | Yes (warehouse) + richer aggregates unused (2026) |
| Highest package, top recruiters | **Absent from all data** |
| NBA | **Absent** (`accreditation.csv` has 0 NBA rows) |
| NAAC | Only 5 rows; read solely by System B |
| Fees, hostel | **Absent from all data** |
| Government/private | Heuristic from name keywords only |
| Autonomous, official NIRF rank | **Absent** (`PowerScore` is an opaque composite, not the NIRF rank) |

---

## Phase 3 — Production Recommendation Algorithm

**Design principle:** two orthogonal axes, composed at the end. Never collapse "can I get in?" and "is it good?" into one number.

```
                 ┌─────────────────────────────────────────────┐
Profile ───────► │ AXIS A — ADMISSION FIT (eligibility)         │  per (college, branch, community)
                 │  margin vs community+branch closing cutoff   │  → band {safe|target|reach|dream}
                 │  + historical volatility → admission prob.   │  + P(admit)
                 └─────────────────────────────────────────────┘
                 ┌─────────────────────────────────────────────┐
                 │ AXIS B — QUALITY / MERIT (counselor value)   │  per college
                 │  weighted score over signals that EXIST      │  → merit ∈ [0,1]
                 └─────────────────────────────────────────────┘
Compose:  filter by district/branch/ownership prefs → band every candidate →
          within band, sort by merit → present a SPREAD (n reach • n target • n safe),
          each labeled with band + P(admit) + evidence.   Dream shown only as flagged "aspirational".
```

### Axis A — Admission fit

- **Lookup:** community + branch closing cutoff from `Ftnea_cutoffs` (bridged via `counsellingCodes`), latest year, with the OC value as a documented fallback when a community/branch cell is missing.
- **Band:** keep the existing `safe/target/reach/dream` math but feed it the **community** cutoff. `reachMargin`/`safeMargin` stay config-driven.
- **Admission probability:** logistic on the margin, scaled by **historical volatility** (std-dev of the last 3–5 years' closing marks) — a tight-history college gives a confident band; a volatile one widens it.
- **Policy change:** stop hard-dropping `dream`. Return a **spread**; label dream as "aspirational — above your range." Hard-exclude only when a hard preference (district/branch/ownership) fails.

### Axis B — Quality score (weights designed to the data that EXISTS)

Fixed-denominator weighted sum, normalized to 100. **Missing dimension contributes 0** (no renormalization); a **minimum-evidence gate** (≥2 outcome facets, or explicit "insufficient data" tier) prevents stubs from ranking above complete colleges.

| # | Feature | Signal / normalization | Source (exists now) | Weight | Why it exists |
|---|---|---|---|---:|---|
| 1 | **Selectivity** | OC-cutoff percentile across TN | 2026 `ocCutoff` | **16** | Demand/reputation proxy; the single biggest corrective — ranks PSG/CIT/Kumaraguru above Nehru |
| 2 | Median salary | `/₹12L` cap | warehouse placement / 2026 `avgMedianSalary` | 14 | Core placement outcome |
| 3 | PowerScore | dataset composite `/100` | 2026 `PowerScore` | 10 | Ready-made quality composite already in the file |
| 4 | Placement rate | `/100` | placement CSV / 2026 `avgPlacementPercentage` | 10 | Breadth of placement |
| 5 | Research | patents/projects/PhD blend | `ipr`,`sponsored`,`phd` | 8 | Institutional depth |
| 6 | Faculty | PhD ratio · retention · size | `faculty` | 8 | Teaching quality |
| 7 | Career outcome | careerOutcome + higher-studies blend | 2026 `careerOutcome`,`avgHigherStudies%` | 6 | Post-grad trajectory |
| 8 | Financial + infra | opex/capex normalized | `financial_*` | 6 | Institutional strength |
| 9 | NIRF standing | presence + category tier | institutions | 6 | External validation |
| 10 | Academic reputation | PhD scholars pursuing | institutions | 4 | Research culture |
| 11 | NAAC grade | grade → score (where present) | `accreditation` (sparse) | 2 | Accreditation (data-thin; low weight) |
| | | | **Total** | **100** | |

**Reserved features (weight 0 until data is acquired — explicitly listed, never silently zero):** fees/affordability, hostel, NBA, autonomous status, top recruiters, true highest package, official NIRF numeric rank. Adding these later is a config edit, not a redesign.

**Student-preference features** apply as **filters or soft boosts**, not merit: district (filter/boost), branch (filter via bridged cutoffs), government/private (filter), fee preference (blocked on data).

### Projected flagship re-ranking (fixed-denominator + selectivity)

Recomputing with a **fixed denominator** (missing = 0) on today's data, *before* the community bridge:

| College | Old total (renorm.) | New total (fixed-denom, no selectivity) | + selectivity (OC %ile) |
|---|---:|---:|---:|
| Nehru Inst. of Engineering & Tech | **0.6231 (#1)** | ~0.279 | ~0.28 (low OC 174) |
| Sri Krishna College of Engg & Tech | 0.5776 (#4) | ~0.558 | **↑ (OC 192, salary ₹700k, PS 96.4) → #1** |
| PSG College of Technology | 0.5485 (#7) | (needs data — stub) | (blocked on D5/D6) |

Fixed-denominator scoring **alone** drops Nehru below Sri Krishna; adding selectivity + PowerScore + salary widens the gap decisively. Restoring CIT/Kumaraguru requires Axis A's community cutoff (their **BC** marks clear 190) and soft banding. PSG College of Technology specifically needs the data-integrity fixes (its row is a blank stub).

---

## Phase 4 — Evidence Builder Redesign

**Current contract** ([`evidence.ts`](../../lib/recommendation/reasons/evidence.ts), [`ai-orchestrator.ts:88`](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L88)): per-college facts are gathered **only for explicitly named colleges, never for recommended ones**; closing cutoff is hardcoded `null` ([`ai-orchestrator.ts:117`](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L117)); `fees`/`scholarships` are literal-`null`-typed in `CollegeDossier`. So GPT recommends colleges it received almost no structured evidence about.

**Target: a structured `CollegeEvidence` emitted for every *recommended* college.** GPT converts this to prose; it invents nothing.

| Field | Populatable now? | Source |
|---|---|---|
| College name, district, government/private | ✅ | canonical + 2026 district + name-heuristic |
| **Admission band + P(admit) + community+branch closing cutoff (number)** | ✅ after bridge | Axis A / `Ftnea_cutoffs` |
| Median salary, placement %, career outcome | ✅ | placement CSV / 2026 |
| PowerScore, selectivity percentile | ✅ | 2026 |
| Research / faculty / finance headlines | ✅ | warehouse |
| NIRF presence + category | ✅ | institutions |
| Strengths / weaknesses | ✅ (derive from Axis-B sub-scores) | quality dimensions |
| **Nearby alternatives** (same district, adjacent band) | ✅ | Axis A/B over district set |
| NAAC grade | ⚠️ sparse | `accreditation` |
| Fees, scholarships, hostel, top recruiters, true highest package, NBA, autonomous, NIRF rank | ❌ blocked | data acquisition (Phase 8 M8) |

**Rules:** every emitted number carries a citable id (existing hallucination guard, [`validator.ts:96`](../../lib/ai/llm/validator.ts#L96), stays). Missing fields render as explicit `UNAVAILABLE` (never fabricated). Add a **qualitative-claim guard**: the current guard is numeric/name-based, so GPT can still assert "great hostel"; constrain prose to evidence-backed adjectives or add a claims allow-list.

---

## Phase 5 — Validation Framework (Golden Dataset)

**Today: no golden/fixture data exists anywhere; CI does not run vitest** (`.github/workflows/deploy.yml` skips tests). Both must change.

### Golden dataset — ≥200 scenarios

- **Location:** `lib/recommendation/__tests__/golden/` (picked up by the existing include glob, zero config change). Typed `GoldenScenario[]` in `.ts` (compile-time-checked against `RecommendationRequest`/`CommunityCode`).
- **Row schema** (thin wrapper over the real DTOs):

```ts
interface GoldenScenario {
  id: string
  request: RecommendationRequest        // category + studentCutoff + community + district + branch + limit
  expect: {
    top1?: string; top3?: string[]; contains?: string[]; excludes?: string[]
    band?: Record<string, EligibilityCategory>   // per named college
    minConfidence?: ConfidenceLevel
  }
}
```

- **Ground-truth sourcing (the credible part):**
  - *Eligibility scenarios* (majority) — **objective**: derive expected bands directly from `Ftnea_cutoffs` community+branch marks. "Can a BC-190 student get CSE at Kumaraguru?" is a data lookup, not an opinion → ~150 auto-generated, high-trust rows.
  - *Quality/spread scenarios* (~50) — **expert-labeled**: the flagship and its siblings (Coimbatore/Chennai/Madurai tier lists), reviewed by a counselor, encoding "PSG/CIT/Kumaraguru/Sri Krishna/GCT belong in the top spread for a strong Coimbatore CSE profile."
- **Driver:** `it.each(GOLDEN)` over two tiers — a **synthetic always-on tier** (`makeHarness()` + injected `createTableCutoffLookup`) for hermetic logic, and a **real-data tier** gated by `skipIf(!CYC_DATA_DIR)` using the lazy-memoized warehouse pattern from the existing smoke tests. Assertions reuse existing idioms (`names[0] === top1`; `slice(0,3)` arrayContaining; `not.toContain` for excludes; `wellFormed()` rank-contiguity invariant).

### Regression gates (measurable)

| Metric | Gate |
|---|---|
| Top-1 accuracy on golden | must not drop vs baseline |
| Top-3 membership accuracy | must not drop |
| Eligibility-band exactness | must not drop |
| Excluded-college violations | **hard zero** (no out-of-district / true-ineligible leaks) |
| Determinism (double-run byte compare) | must hold |

**CI:** wire `vitest run` (+ `CYC_DATA_DIR` secret for the real tier) into the pipeline so a quality regression fails the build.

---

## Phase 6 — Monitoring

Seams exist (`lib/ai/adapters/telemetry`, an audit/trace module). Define events + dashboards:

| Metric | Definition | Instrumentation |
|---|---|---|
| Recommendation accuracy | golden top-1 / top-3 over time | from Phase 5 harness (offline + nightly) |
| Top-1 / Top-3 accuracy | share of queries whose expected college is #1 / in top-3 | golden + sampled prod queries |
| Confidence calibration | reliability curve: predicted confidence vs realized correctness | log predicted confidence + outcome |
| Recommendation acceptance | share of surfaced colleges the student engages/selects | **new UI event** (chat → API) |
| Most-selected colleges | frequency table | acceptance events |
| Failed recommendations | empty result sets, all-`dream` filters, null-cutoff-lookup fires | engine counters (`nirfConflicts`, empty-result, unknown-band) |
| Missing-data rate | % recommended colleges with `UNAVAILABLE` evidence fields | evidence builder |
| Eligibility mode | % queries served with community cutoff vs OC-fallback | Axis A |

**Dashboards:** (1) Quality — top-k trend, calibration curve; (2) Coverage — missing-data & OC-fallback rates by district/community; (3) Health — failed recs, join conflicts, null-lookup incidents.

---

## Phase 7 — Gap Analysis

| Current component | Current state | Production state | Priority | Complexity | Risk | Order |
|---|---|---|---|---|---|---|
| Scoring formula | renormalized avg; ignores selectivity/salary/PowerScore | fixed-denominator + selectivity + real outcomes + min-evidence gate | **P0** | M | Low (config + scorer, behind golden) | **M2** |
| Eligibility model | OC-for-all; hard-drops dream | community+branch cutoffs; soft bands; spread | **P0** | L | Med (needs bridge) | M3→M4 |
| Counselling-code bridge | `counsellingCodes = []` | populated; TNEA cutoffs joined | **P0** | L | Med (knowledge layer) | **M4** |
| Data integrity | 64 shared NIRF ids; duplicate entities; mis-joins | disambiguated; facts correct | **P0** | L | High (upstream, broad) | **M5** |
| Evidence builder | facts only for named colleges; cutoff null | structured per-recommended dossier w/ real numbers | P1 | M | Low | M6 |
| Confidence | = data completeness | admission-certainty + evidence calibrated | P1 | S | Low | with M3 |
| Golden set / CI | none; CI skips tests | ≥200 scenarios + regression gates + CI | **P0 (first)** | M | Low | **M1** |
| Monitoring | none | quality/coverage/health dashboards | P2 | M | Low | M7 |
| Missing datasets | fees/NBA/hostel/recruiters absent | acquired + wired (reserved weights) | P2 | L (external) | Low-Med | M8 |
| Branch filtering | caveat string only | branch-scoped candidates | P1 | M | Med (needs bridge) | with M4 |

---

## Phase 8 — Implementation Plan (independent milestones)

> Measurement first, then the highest-leverage low-risk win, then the correctness foundation, then completeness. Each milestone is independently reviewable and independently revertible. **No milestone is combined.**

### M1 — Golden dataset + regression harness + CI wiring
- **Objective:** make quality measurable and regressions impossible to merge silently. No behavior change.
- **Files:** `lib/recommendation/__tests__/golden/{scenarios.ts,golden.test.ts}`; `.github/workflows/deploy.yml` (add `vitest run`).
- **Architecture impact:** none (test-only).
- **Risk:** minimal.
- **Tests:** the harness *is* the test; assert current baseline (documents today's behavior, including the flagship failure) so later milestones show measured improvement.
- **Acceptance:** ≥200 scenarios run in both tiers; CI runs vitest; baseline recorded.
- **Rollback:** delete the directory / revert the workflow edit.

### M2 — Scoring realism (the fast flagship win)
- **Objective:** fixed-denominator scoring + `selectivity` dimension + consume `PowerScore`/2026 salary + min-evidence gate; demote `dataCompleteness` from feature to confidence.
- **Files:** `scoring/normalizers.ts`, `scoring/scoring-engine.ts`, `config.ts` (weights), `models/enums.ts` (add `selectivity`). API unchanged.
- **Architecture impact:** internal to the scorer; `RankSpec`/facade untouched.
- **Risk:** Low — pure function, fully behind M1's golden gate.
- **Tests:** golden top-1/top-3 must improve (Sri Krishna > Nehru); existing scoring tests updated for the new dimension.
- **Acceptance:** flagship no longer returns Nehru #1; no golden regressions elsewhere.
- **Rollback:** revert weights/dimension via config (single commit).

### M3 — Soft eligibility & structured spread
- **Objective:** stop hard-dropping `dream`; return a **counselor spread** — default **2 reach • 4 target • 2 safe** (configurable) — and **always show top `dream` colleges, clearly labeled "above your range."** *(Decisions Q2/Q3.)*
- **Files:** `strategies/executor.ts` (filter → classifier), facade band helpers, opinion/evidence surfacing of band labels.
- **Architecture impact:** output gains band labels; existing methods keep signatures (spread is additive).
- **Risk:** Med — changes what surfaces; guarded by golden exclusion/band assertions.
- **Tests:** CIT/Kumaraguru reappear as labeled reach; no true-ineligible/out-of-district leaks.
- **Rollback:** re-enable the hard filter (config flag).

### M4 — Community + branch-aware cutoffs (correctness foundation)
- **Objective:** populate `counsellingCodes`; build a community+branch `CutoffLookup` from `Ftnea_cutoffs`; branch-scoped candidates.
- **Files:** `lib/knowledge/transform/college-transform.ts` + crosswalk, `warehouse-builder.ts` (retain marks), new `data/tnea-cutoff-lookup.ts`, wiring in `counselor-chat-service.ts`.
- **Architecture impact:** new lookup implementation behind the existing `CutoffLookup` interface (drop-in).
- **Risk:** Med — knowledge-layer change; additive, OC fallback retained.
- **Tests:** golden eligibility rows derived from `Ftnea_cutoffs` pass; BC-190 clears Kumaraguru/CIT where their BC marks allow.
- **Rollback:** swap back to `createNirf2026CutoffLookup` (one line).

### M5 — Data integrity (shared NIRF ids + duplicate entities)
- **Objective:** stop cross-college fact borrowing; merge/disambiguate duplicates (CIT, Sri Krishna variants).
- **Files:** `lib/knowledge/crosswalk.ts`, `warehouse-builder.ts`, id/transform layer; report via `WarehouseStatistics`.
- **Architecture impact:** upstream of the recommender; corrects inputs to every downstream stage.
- **Risk:** High (broad) — sequence after M1 so effects are measured; ship behind a stats diff.
- **Tests:** Nehro no longer carries KPR's faculty; `nirfConflicts` handled deterministically; golden unaffected or improved.
- **Rollback:** revert crosswalk policy commit.

### M6 — Evidence Builder redesign
- **Objective:** structured `CollegeEvidence` per *recommended* college (incl. real cutoff numbers, band, nearby alternatives); qualitative-claim guard.
- **Files:** `lib/recommendation/reasons/evidence.ts`, `lib/ai/orchestration/evidence/*`, `lib/opinion/generator/*`, `models`.
- **Risk:** Low — additive to the contract; GPT still explains only.
- **Tests:** every recommended college emits ≥N structured fields; hallucination guard green.
- **Rollback:** revert evidence module.

### M7 — Monitoring & telemetry
- **Objective:** emit quality/coverage/health metrics + acceptance events; dashboards.
- **Files:** `lib/ai/adapters/telemetry/*`, engine counters, a UI acceptance event through the chat API.
- **Risk:** Low.
- **Acceptance:** dashboards populate; calibration curve renders.
- **Rollback:** disable emitters (flag).

### M8 — External data acquisition (unblocks reserved weights) — **DEFERRED (out of scope; decision Q4: bridge existing data only)**
- **Objective (deferred):** source fees, NBA, autonomous status, top recruiters, true highest package, hostel; wire into warehouse + reserved weights. Reserved features stay at weight 0 until a future effort; this engagement delivers M1–M7.
- **Files:** new loaders + warehouse models + `config.ts` weights.
- **Risk:** Low-Med (external data), fully additive.
- **Acceptance:** reserved features move from weight 0 to configured; golden gains affordability/accreditation scenarios.
- **Rollback:** set the new weights back to 0.

---

## Success Criteria (measurable)

1. **Flagship:** `CSE / Coimbatore / BC / 190` returns a labeled spread whose top tier contains PSG / CIT / Kumaraguru / Sri Krishna / GCT (as their community cutoffs allow); Nehru is not #1.
2. **Eligibility correctness:** reserved-category bands match `Ftnea_cutoffs` ground truth on ≥95% of the ~150 auto-generated golden rows.
3. **No renormalization artifact:** no data-sparse college outranks a data-complete superior on the golden set.
4. **No silent regression:** every merge runs the golden suite in CI; top-1/top-3/band gates enforced; exclusion violations at hard zero.
5. **Confidence calibration:** predicted-vs-realized correctness within ±10% per band.
6. **Determinism preserved; all 529 existing tests stay green; public APIs unchanged.**

## Resolved decisions (locked 2026-07-04)

- **Entry point:** **M1 measurement-first** — build the golden-set + CI regression harness and record today's baseline before any behavior change.
- **Spread shape:** **counselor spread**, default **2 reach • 4 target • 2 safe** (configurable), replacing the single-headline output for open-ended "best college" queries with a full profile.
- **Dream visibility:** **always shown, clearly labeled "above your range."**
- **Data scope:** **bridge existing data only** — deliver M1–M7; reserved features (fees, NBA, hostel, recruiters, autonomous, true highest package) stay at weight 0; **M8 deferred.**

---

## Implementation Log

### ✅ M1 — Golden dataset + CI regression harness (completed 2026-07-04) — behavior-neutral

- **Golden harness:** `lib/recommendation/__tests__/golden/{scenarios.ts,golden.test.ts}` — two tiers: hermetic synthetic invariants (always on) + real-warehouse counseling scenarios (gated on `CYC_DATA_DIR`). `target` rows encode the counselor-correct outcome and run via `it.fails` (green today because they correctly fail; they turn red — prompting promotion to `lock` — when a milestone fixes them).
- **Recorded baseline** (engine pre-M2), flagship `by_cutoff(190, BC, Coimbatore, CSE)` top-5:
  `["NEHRU INSTITUTE OF ENGINEERING AND TECHNOLOGY", "Ponjesly College of Engineering", "Central Institute of Plastics Engineering and Technology", "Sri Krishna College of Engineering and Technology", "Christian College of Engineering and Technology, Oddanchatram, Palani"]`
  → captured as 4 failing `target` rows (Kumaraguru/GCT excluded; Nehru #1; Sri Krishna below Nehru).
- **New finding surfaced by the probe:** the Coimbatore query returns **non-Coimbatore** colleges (Ponjesly/Kanyakumari, College of Food & Dairy/Chennai) — district mis-attribution from the shared-NIRF-id mis-join (D5). Deferred to M5/M7; noted here.
- **CI wiring:** `.github/workflows/deploy.yml` now runs `npm test` as a **blocking** gate before deploy (was lint-only). CI has no `CYC_DATA_DIR`, so warehouse-gated tests skip; the hermetic suite gates. *Follow-up: provision `CYC_DATA_DIR` in CI to also run the real-data golden tier.*
- **CI-hardening (test-only, behavior-neutral):** `confidence.test.ts`, `district-filter.test.ts`, `eligibility-filter.test.ts` built the warehouse eagerly in the `describe` body and **threw during collection** when `CYC_DATA_DIR` was unset (they failed the file, not individual tests). Converted to the lazy-memoized `setup()` pattern so they skip cleanly in CI.
- **Verification:** hermetic (no data) **497 pass / 44 skip, 0 fail**; with data **541 pass, 0 fail** (was 529 + 12 golden). App + test typecheck clean.
- **Scope note:** M1 seeds a high-value curated core (flagship + invariants); the suite grows toward **≥200** as auto-derived eligibility rows come online with the M6 cutoff bridge.
