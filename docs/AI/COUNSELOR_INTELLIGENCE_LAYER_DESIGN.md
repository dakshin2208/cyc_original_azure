# Counselor Intelligence Layer — Principal Engineering Design Review

**Author:** Principal AI Architect
**Date:** 2026-07-04
**Status:** ✅ APPROVED 2026-07-04 — implementation begins milestone-by-milestone (M1 first). See *Resolved decisions*.
**Consolidates:** [RECOMMENDATION_ENGINE_ARCHITECTURE_REVIEW.md](./RECOMMENDATION_ENGINE_ARCHITECTURE_REVIEW.md) (audit + numeric model) and [COUNSELOR_REASONING_DESIGN.md](./COUNSELOR_REASONING_DESIGN.md) (reasoning layer) into **one plan**. This is the top-level proposal; the two companions hold the code-level detail already approved.

> **Framing.** We are building an **AI Admission Counselor**, not a recommender. The difference is a layer that *understands the student*, *chooses how to counsel them*, *reasons comparatively about opportunities*, and *explains its guidance* — all deterministically, with GPT narrating only. This document specifies that layer: the **Counselor Intelligence Layer (CIL)**.

---

## Three assumptions I am challenging (read first)

1. **"CIL sits between Profile and Engine" vs. "architecture is FINAL."** The CIL is **not** a new pipeline stage. It is the **reasoning brain hosted inside the AI Orchestrator**: it reads the profile, selects a strategy, frames the consideration set, *parameterizes* the Recommendation Engine (which stays the single source of truth), and post-processes engine output into structured guidance. Data-flow shape unchanged. Any other reading would break the FINAL constraint.
2. **"Do NOT hard-code college rankings" vs. the curated reputation prior (approved DP-1).** Reframed as a **design correction**: reputation tier is a **deterministic, evidence-derived function** (multi-year cutoff selectivity percentile + NIRF + placement + autonomous/government). The curated seed is demoted to a **fallback floor for missing-data colleges only**, and **every seeded entry must cite the external evidence justifying it**. No final rank is ever hand-set; the transparent comparator ranks. This is expert knowledge documented with evidence — not hard-coded preference.
3. **Deep Student Understanding needs uncollected data.** Today's profile holds only cutoff/community/district/branch/preferred-college. Budget, risk tolerance, placement priority, higher-studies/research interest, hostel, location flexibility, parent constraints are **not collected**. The CIL **infers what it can, defaults the rest, and flags every default as an explicit assumption**; strategy degrades to "balanced" without signals. A *small optional additive* profile extension is the honest prerequisite for sharp strategy selection (milestone, low priority, respects "don't over-invest in conversation").

---

## 1. Architecture Review

Current pipeline (FINAL, unchanged): `Student → Conversation → Profile Manager → AI Orchestrator → Recommendation Engine (source of truth) → Evidence Builder → GPT-4.1 (explain only) → Response`.

**Where the CIL lives — inside the Orchestrator, wrapping the engine:**

```
Profile ─► AI ORCHESTRATOR ───────────────────────────────────────────────► Evidence ─► GPT ─► Response
             │   ┌──────────────── COUNSELOR INTELLIGENCE LAYER ─────────────────┐
             │   │ 1 Student Understanding   → StudentUnderstanding (archetype)  │
             │   │ 2 Strategy Selection      → CounselingStrategy (+ engine cfg) │
             │   │ 3 Consideration Framing   → attainability set (calls Engine)  │ ◄── Recommendation
             │   │ 4 Opportunity + Rules     → tiers, expert rules, comparator   │      Engine stays
             │   │ 5 Categories + Trade-offs → Dream/Target/Safe + Best-X + why  │      the source of
             │   │ 6 Evidence assembly       → structured CollegeEvidence[]      │      truth (called,
             │   └───────────────────────────────────────────────────────────────┘      never bypassed)
```

The engine is **called and parameterized**, never bypassed or overridden. The CIL adds *understanding* (front) and *guidance shaping* (back) around deterministic ranking.

---

## 2. Current Weaknesses

Carried from the two companion docs (proven with `path:line` there), grouped by the counselor capability they block:

- **Ranking:** renormalization rewards sparse data; selectivity/reputation not scored; alphabetical tie-break; independent (non-comparative) scoring. → *No opportunity reasoning.*
- **Eligibility:** OC cutoff for all communities; hard-drop of "dream." → *Wrong attainability for reserved students; aspirational options hidden.*
- **Data integrity:** 64 shared NIRF ids mis-join facts (Nehru←KPR); duplicate entities. → *Reasons over another college's data.*
- **Evidence/confidence:** facts only for named colleges; cutoff hardcoded null; confidence = data completeness. → *Thin, mis-calibrated guidance.*
- **NEW — no student understanding:** the engine treats every student identically; no archetype, no priorities, no risk model.
- **NEW — no strategy selection:** one fixed weight profile for everyone; a placement-focused and an ROI-focused student get the same ranking.
- **NEW — flat output:** a single ranked list, not Dream/Target/Safe + Best-X structured guidance; no trade-off reasoning.

---

## 3. Counselor Intelligence Architecture

Six deterministic sub-modules inside the Orchestrator. Each is independently testable; none calls GPT; all emit an auditable trace.

| # | Sub-module | Input | Output | Companion detail |
|---|---|---|---|---|
| 1 | **Student Understanding** | StudentProfile (+ optional attrs) | `StudentUnderstanding` {priorities, risk, constraints, archetype, assumptions} | §4 (new) |
| 2 | **Strategy Selection** | StudentUnderstanding | `CounselingStrategy` + engine weight profile + rule emphasis | §5 (new) |
| 3 | **Consideration Framing** | profile + strategy | attainability set (bands + P(admit)) — **calls the Engine's eligibility** | Reasoning L1; bridge M6 |
| 4 | **Opportunity + Rules** | consideration set + strategy | tiered opportunity value + expert-rule trace + comparator order | Reasoning L2–L4 |
| 5 | **Categories + Trade-offs** | ranked set | Dream/Target/Safe + Best-X + trade-off records | §7, §8 (new) |
| 6 | **Evidence Assembly** | all of the above | `CollegeEvidence[]` (facts + comparative + assumptions + confidence) | §9; Reasoning L5 |

**Contract in:** `StudentProfile`. **Contract out:** a `CounselingResult` = `{ understanding, strategy, categories: {dream[], target[], safe[]}, superlatives: {bestOverall, bestPlacement, bestROI, bestGovernment, bestPrivate, bestLocal, bestValue}, evidence: CollegeEvidence[], assumptions[], confidence }`. GPT receives this and narrates; it decides nothing.

---

## 4. Student Understanding Model

Deterministic classifier: `StudentProfile → StudentUnderstanding`. **Every field degrades gracefully; every default is flagged.**

```ts
interface StudentUnderstanding {
  priorities: Record<'placement'|'roi'|'research'|'academics'|'location'|'brand', number> // Σ=1, default uniform
  riskTolerance: 'conservative' | 'moderate' | 'ambitious'   // default 'moderate' (flagged)
  constraints: { district?: string; branch?: string; ownership?: 'government'|'private'; budget?: number; needsHostel?: boolean }
  archetype: StudentArchetype
  confidence: number            // how much of this came from real signals vs defaults
  assumptions: string[]         // e.g. "priorities defaulted (no stated preference)"
}
```

**Signal sources (honest):**
- *Available now:* cutoff, community, district (→ location constraint if inflexible), branch (→ research lean if the branch is research-heavy), preferred college.
- *Inferable:* risk tolerance from cutoff position vs district option spread (a high-cutoff student has more safe options → can be ambitious); brand lean if the student named an elite preferred college.
- *Not collected (default + flag):* budget, ownership preference, placement priority, higher-studies/research interest, hostel, location flexibility, parent constraints. → optional additive profile slots (milestone M-Profile, low priority).

**Archetypes** (coarse, for strategy + explanation tone; each carries a confidence): `HighAchieverBrandSeeking`, `ROIConscious`, `PlacementFocused`, `ResearchOriented`, `LocationBound`, `BudgetConstrained`, `BalancedUndecided` (default). Assignment is a deterministic decision table over priorities + constraints; ties → `BalancedUndecided`.

**Principle:** understanding never invents facts about the *student*; unknowns become explicit assumptions the counselor (and GPT) must state ("assuming a balanced priority since you didn't specify").

---

## 5. Counseling Strategy Model

The core new intelligence: **different students get counseled differently, deterministically.** `StudentUnderstanding → CounselingStrategy`.

**Strategies:** `PlacementFocused`, `ROIFocused`, `GovernmentFirst`, `ResearchFocused`, `LocationFocused`, `BudgetFocused`, `Balanced`.

**Selection — priority-ordered decision table (first match wins; else Balanced):**

| Priority | Condition (from StudentUnderstanding) | Strategy | Why |
|---|---|---|---|
| 1 | hard budget constraint set | `BudgetFocused` | affordability gates everything |
| 2 | ownership = government (explicit) | `GovernmentFirst` | ROI + stated preference |
| 3 | location inflexible (must stay in district) | `LocationFocused` | geography is a hard constraint |
| 4 | research/higher-studies interest dominant | `ResearchFocused` | outcome goal is academia |
| 5 | placement priority dominant | `PlacementFocused` | outcome goal is a job |
| 6 | ROI-conscious archetype (no hard govt pref) | `ROIFocused` | value-for-money lens |
| 7 | *else* | `Balanced` | default; safest, most general |

**Effect of a strategy (emphasis only — never truth):**
- Selects the **engine weight profile** (existing `strategyWeights`: `best_placement`, `best_roi`, …) fed to L2 within-tier scoring.
- Sets **rule-engine emphasis** (e.g. `GovernmentFirst` strengthens R4 govt-ROI; `ResearchFocused` lifts R7 depth).
- Chooses which **Best-X superlatives** to foreground (e.g. `ROIFocused` → lead with Best ROI + Best Government).
- **Invariant:** strategy changes *emphasis and presentation*, never eligibility truth, never evidence, never tier floors. A wrong strategy guess produces a differently-emphasized-but-still-valid ranking, and the selection reason + confidence are surfaced ("counseling with a balanced strategy — tell me if placements matter most").

Every selection emits a one-line reason and a confidence (low when driven by defaults).

---

## 6. Comparative Reasoning Engine

Fully specified in [COUNSELOR_REASONING_DESIGN.md §3–5](./COUNSELOR_REASONING_DESIGN.md). Summary: **tiers dominate, scores refine, rules arbitrate** (DP-2). A **lexicographic pairwise comparator** (tier → rule ladder R0–R13 → within-tier score → stable id) yields a cycle-free total order; the deciding rule per adjacent pair is recorded as the "why A > B." Reputation tier is the **evidence-derived function** of §challenge-2, with the curated seed only a justified floor for missing-data colleges. Comparator properties (totality, transitivity/cycle-freeness) are property-tested.

---

## 7. Recommendation Categories

Never a single flat list. Two orthogonal groupings over the consideration set:

**A. Attainability bands (the spread — locked 2 reach • 4 target • 2 safe):**
- **Dream** — above range; always shown, clearly labeled "aspirational."
- **Target** — realistic; the headline picks come from here.
- **Safe** — backup; high P(admit).

**B. Superlatives (each a deterministic argmax under one lens; `N/A` + reason when data absent):**

| Category | Selection | Data status |
|---|---|---|
| Best Overall | max opportunity under the selected strategy, within target/safe | active |
| Best Placement | max placement/salary among attainable | active |
| Best ROI | government-or-high-value × placement (fees absent → proxy, flagged) | active (proxy) |
| Best Government | max opportunity among government (name-heuristic) | active |
| Best Private | max opportunity among private | active |
| Best Local Option | max opportunity within preferred district | active |
| Best Value | max (opportunity ÷ selectivity-cost) — strong college that's easier to get | active |

Every category entry carries a one-line reason grounded in evidence.

---

## 8. Trade-off Engine

Per recommended college, deterministic records (templates filled from the comparator + tier + attainability + strategy fit; GPT narrates concisely per DP-3):

- **Why this college** — tier + attainability + strategy fit.
- **Why not the alternative** — the comparator's deciding rule vs the adjacent college.
- **Advantages / disadvantages** — top opportunity signals / weaknesses + `unavailable` fields.
- **Who should choose it** — the archetype it best serves (e.g. "placement-focused students who can reach a target cutoff").
- **Who should avoid it / when to prefer another** — e.g. "budget-constrained students may prefer the government option; research-focused students may prefer higher-depth X."

This directly answers your "who should choose / who should avoid / when prefer another."

---

## 9. Evidence Generation Design

Fully specified in [COUNSELOR_REASONING_DESIGN.md §6](./COUNSELOR_REASONING_DESIGN.md). Structured `CollegeEvidence` per **recommended** college (fixes "facts only for named colleges"): attainability (real cutoff number, band, P(admit), volatility), opportunity signals + tier, comparative edge (`decidedBy` rule), strengths/trade-offs/assumptions, confidence, nearby alternatives, and an explicit `unavailable` list. **Availability is honest** — present now: cutoff/tier/placement/salary/selectivity/autonomous/government/NIRF-presence/strengths/assumptions; **blocked (data absent, marked `unavailable`, never fabricated):** top recruiters, true highest package, NBA, NAAC (5 rows only), fees, scholarships, hostel, distance, NIRF numeric rank. Numeric/name hallucination guard retained ([`validator.ts:96`](../../lib/ai/llm/validator.ts#L96)); add a qualitative-claim guard.

---

## 10. Validation Strategy

Extends the review's golden harness with counselor + strategy labels. **≥200 scenarios**, two-tier:

- **Objective tier (~150, auto-derived):** attainability bands from `Ftnea_cutoffs` community+branch ground truth. No human judgment needed → high trust, cheap to scale.
- **Expert tier (~60, counselor-labeled):** per scenario — profile, **expected strategy**, expected Dream/Target/Safe, expected Best-X, expected top-3 ranking, expected key reasons, expected confidence. Anchored by the flagship + regional tier lists.

Plus: **strategy-selection unit tests** (each decision-table branch), **archetype-classification tests**, **rule unit tests** (R0–R13), **comparator property tests** (cycle-freeness), **calibration** (predicted vs realized ±10%). **Regression gates in CI** (currently `vitest` is skipped — must be wired): top-1/top-3/band/strategy-match/exclusion-zero, determinism double-run. **Counselor-agreement KPI** (top-3 overlap with a labeled panel) is the headline production metric. Honest cost note: labeling 60 expert scenarios with strategy+reasoning+confidence is real human effort and is on the critical path for the expert tier.

---

## 11. Monitoring Strategy

| Metric | Definition | Source |
|---|---|---|
| Top-1 / Top-3 accuracy | vs golden + sampled prod | harness |
| Counselor agreement | top-3 overlap with expert panel | expert tier + periodic review |
| Strategy distribution | which strategies fire, how often | CIL trace |
| Recommendation acceptance / satisfaction | student engages/selects surfaced college; thumbs | **new UI event** |
| Recommendation drift | ranking shifts for the same profile across releases | golden snapshot diff |
| Prior-vs-data drift | curated tier vs data tier disagreement | tier module (governance) |
| Missing-data rate / low-confidence rate | % `unavailable` fields; % low-confidence recs | evidence/confidence |
| Hallucination prevention | guard rejections, fabricated-fact catches | LLM validator counters |

Dashboards: **Quality** (top-k, counselor agreement, calibration), **Coverage** (missing-data, OC-fallback, strategy mix), **Health** (drift, join conflicts, guard rejections).

---

## 12. Gap Analysis

| Capability | Current | Production (CIL) | Priority | Complexity | Risk | Order |
|---|---|---|---|---|---|---|
| Measurement/CI harness | none; CI skips tests | ≥200 golden + gates + CI | **P0-first** | M | Low | M1 |
| Scoring realism | renorm; reputation-blind | fixed-denom + selectivity + real signals | P0 | M | Low | M2 |
| Opportunity tiers + prior | none | evidence-derived tiers + justified floor | P0 | L | Med | M3 |
| Expert rules + comparator | independent scoring | R0–R13 + lexicographic pairwise | P0 | L | Med | M4 |
| Soft eligibility + spread | hard-drop dream | Dream/Target/Safe, labeled | P0 | M | Med | M5 |
| Community/branch cutoffs | OC-for-all; unbridged | bridged community+branch lookup | P0 | L | Med | M6 |
| Data integrity | shared ids; duplicates | dedup + correct joins | P0 | L | High | M7 |
| **Student Understanding** | none | archetype + priorities + risk (defaults flagged) | P1 | M | Low | M8 |
| **Strategy Selection** | one fixed profile | deterministic per-student strategy | P1 | M | Low-Med | M9 |
| **Categories + Trade-offs** | flat list | Dream/Target/Safe + Best-X + trade-offs | P1 | M | Low | M10 |
| Evidence + Explanation | thin; named-only | structured, comparative, 6 whys | P1 | M | Low | M11 |
| Monitoring | none | quality/coverage/health + counselor KPI | P2 | M | Low | M12 |
| Optional profile extension | 4 slots | +optional budget/risk/priority slots | P3 | S | Low | M-Profile |
| External data (fees/NBA/…) | absent | acquired + reserved rules active | **deferred (Q4)** | L | — | — |

---

## 13. Production Roadmap

**Sequencing logic:** measure first → make the engine *rank* well (M2–M7) → then add the *counselor brain* (M8–M11) on top of a ranking that's worth personalizing → then monitor. The CIL front-end (M8–M9) defaults to `Balanced` = current behavior, so it is additive and low-risk and *can* be parallelized earlier, but delivers value only once M2–M4 land. M-data acquisition stays deferred (decision Q4).

```
M1 golden/CI ─► M2 scoring ─► M3 tiers+prior ─► M4 rules+comparator ─► M5 spread ─► M6 cutoff bridge ─► M7 data integrity
                                                                                              └─► M8 Student Understanding ─► M9 Strategy ─► M10 Categories+Trade-offs ─► M11 Evidence/Explanation ─► M12 Monitoring
```

---

## 14. Milestone Implementation Plan

M1–M7 detail lives in the two companion docs (carried forward unchanged). Full detail below for the **new CIL milestones (M8–M11)**; M1–M7 and M12 summarized.

**M1 Golden + CI** · behavior-neutral harness (≥200 scenarios incl. counselor-labeled + strategy labels), CI wiring, recorded baseline. *Files:* `__tests__/golden/*`, deploy workflow. *Risk:* Low. *Rollback:* delete folder.
**M2 Scoring realism** · fixed-denominator + selectivity + PowerScore/salary + min-evidence gate. *Risk:* Low (behind golden).
**M3 Opportunity tiers + evidence-derived reputation baseline (justified floor)** · new `opportunity/` module; drift monitor. *Risk:* Med.
**M4 Expert rules + comparator** · new `reasoning/` module; R0–R13; lexicographic pairwise. *Risk:* Med.
**M5 Soft eligibility + spread** · bands not exclusion; Dream/Target/Safe. *Risk:* Med.
**M6 Community/branch cutoff bridge** · populate `counsellingCodes`; Ftnea lookup. *Risk:* Med.
**M7 Data integrity** · dedup entities; correct NIRF joins. *Risk:* High (upstream).

### M8 — Student Understanding Model
- **Objective:** deterministic `StudentProfile → StudentUnderstanding` (priorities, risk, constraints, archetype, assumptions), degrading gracefully with flagged defaults.
- **Files:** new `lib/ai/orchestration/counselor/student-understanding.ts` (+ types, tests); consumed by the orchestrator.
- **Architecture impact:** additive; orchestrator computes understanding before calling the engine. No engine change.
- **Risk:** Low — pure function; defaults reproduce today's behavior.
- **Acceptance:** archetype + priorities derived deterministically; every unknown emits an assumption; unit tests per branch.
- **Rollback:** stop computing understanding (feature flag) → engine runs as today.
- **Testing:** decision-table unit tests; property test that missing data never throws and always flags.

### M9 — Counseling Strategy Selection
- **Objective:** deterministic `StudentUnderstanding → CounselingStrategy` (priority-ordered table) mapping to engine weight profile + rule emphasis + foregrounded categories; emit selection reason + confidence.
- **Files:** new `lib/ai/orchestration/counselor/strategy-selection.ts` (+ tests); orchestrator passes the chosen weight profile into the engine call (engine already accepts per-strategy weights via `strategyWeights`).
- **Architecture impact:** additive; the engine is *parameterized*, not modified. `Balanced` = current profile → zero behavior change by default.
- **Risk:** Low-Med — changes emphasis; guarded by golden strategy-match assertions.
- **Acceptance:** each table branch selects the intended strategy with a reason; strategy never alters eligibility/evidence/tier floors (invariant test).
- **Rollback:** force `Balanced` (flag).
- **Testing:** strategy-selection unit tests; golden expected-strategy assertions; invariant test (same consideration set regardless of strategy).

### M10 — Recommendation Categories + Trade-off Engine
- **Objective:** produce Dream/Target/Safe + the seven Best-X superlatives + per-college trade-off records (who-should-choose / avoid / when-prefer-another).
- **Files:** new `lib/ai/orchestration/counselor/categories.ts`, `trade-offs.ts` (+ tests); extends `CounselingResult`.
- **Architecture impact:** additive post-processing over the ranked set; consumed by evidence + GPT.
- **Risk:** Low — deterministic selection/templates over existing ranking.
- **Acceptance:** each superlative is a correct argmax or `N/A`+reason; trade-off records reference the comparator's deciding rule; no fabricated fields.
- **Rollback:** emit only the flat spread (flag).
- **Testing:** argmax correctness per lens; `N/A` when data absent; trade-off records grounded in evidence ids.

### M11 — Evidence + Explanation redesign
- **Objective:** structured `CollegeEvidence` per recommended college (comparative edge, assumptions, confidence, `unavailable`); the six "why" answers rendered concisely (DP-3), full pairwise chains on demand. GPT narrates only.
- **Files:** `lib/recommendation/reasons/evidence.ts`, `lib/ai/orchestration/evidence/*`, `lib/opinion/*`; qualitative-claim guard in `lib/ai/llm/validator.ts`.
- **Architecture impact:** additive to the evidence contract; GPT authority unchanged.
- **Risk:** Low.
- **Acceptance:** every recommended college emits the full evidence struct; hallucination guards green; assumptions surfaced.
- **Rollback:** revert evidence module.
- **Testing:** contract tests (all fields present or explicitly `unavailable`); guard tests for numeric + qualitative fabrication.

### M12 — Monitoring
- **Objective:** counselor-agreement KPI, strategy distribution, drift, calibration, coverage/health dashboards; acceptance UI event.
- **Files:** `lib/ai/adapters/telemetry/*`, engine/CIL counters, one chat-API acceptance event.
- **Risk:** Low. *Rollback:* disable emitters (flag).

### M-Profile (optional, low priority)
- **Objective:** additive optional profile slots (budget, ownership pref, placement/research priority, hostel, location flexibility) to sharpen M8/M9 — collected only if the student volunteers; never blocks a recommendation.
- **Risk:** Low; respects "don't over-invest in the conversation layer" by being optional + default-safe.

---

## Resolved decisions (locked & approved 2026-07-04)

- **DP-4 — CIL placement: CONFIRMED.** Implemented **inside the AI Orchestrator**, parameterizing the engine; no new pipeline stage.
- **DP-5 — Reputation: evidence-derived + justified floor.** Tier = deterministic function of multi-year cutoff selectivity + NIRF + placement + autonomous/government; curated seed is a **fallback floor for missing-data colleges only**, each entry evidence-justified, versioned, drift-monitored. **This supersedes DP-1 ("curated prior + proxies") in [COUNSELOR_REASONING_DESIGN.md](./COUNSELOR_REASONING_DESIGN.md).** No final rank is ever hand-set.
- **DP-6 — Optional profile extension: DEFERRED.** Strategy selection runs on collected fields + inference + flagged defaults (degrades to `Balanced`). The additive optional slots (M-Profile) are out of scope for now.
- **Go-ahead:** APPROVED — begin with **M1** (golden dataset + CI harness; behavior-neutral).
