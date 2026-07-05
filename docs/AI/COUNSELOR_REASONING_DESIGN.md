# Counselor-Grade Reasoning — Recommendation Engine Redesign

**Author:** Principal AI Architect
**Date:** 2026-07-04
**Status:** ✅ Design decisions locked (see *Resolved decisions*) — ⏳ awaiting explicit go-ahead to begin **M1**; no code until then
**Companion to:** [RECOMMENDATION_ENGINE_ARCHITECTURE_REVIEW.md](./RECOMMENDATION_ENGINE_ARCHITECTURE_REVIEW.md) (the code-level audit + numeric-model plan). This document adds the **expert-reasoning layer** the review left open, and refines Axis B (quality) into **Opportunity Value** and the ranking into **comparative counselor judgment**.

> **Thesis.** Move the engine from *"which college has the highest weighted score?"* to *"among the colleges this student can realistically get, which one creates the best future opportunity?"* — implemented as a **deterministic, versioned reasoning system**, not as GPT. GPT still only narrates. Determinism, auditability, and the 529-test suite are preserved.

> **Non-negotiable framing.** "Reason like a counselor" ≠ "let the LLM decide." The reasoning is a deterministic, testable rule engine + comparator producing an auditable trace; GPT converts that trace to prose. This is the only way to get human-like judgment that is also reproducible, regression-gated, and free of hallucinated rankings.

---

## 1. Root Cause Analysis

The review proved four ranking/eligibility defects (D1 community-blind eligibility, D2 hard dream-exclusion, D3 renormalization rewards sparse data, D4 score ignores real quality) and two data-integrity defects (D5 shared-NIRF-id mis-join, D6 duplicate entities). All still hold. This request exposes **four deeper, paradigm-level root causes** that no amount of weight-tuning fixes:

- **RC-A — No concept of "opportunity value" or reputation tier.** The score is a *continuous* number over facility metrics. A counselor thinks in **tiers**: PSG/CIT are a different class than a regional college, and a 0.02 score difference never reorders across that class boundary. Today, marginal numeric noise (and D3's renormalization) freely reorders colleges a counselor would never swap. *There is no notion that "PSG, if attainable, dominates most alternatives."*
- **RC-B — Eligibility and desirability are conflated, not separated.** "Can I get in?" (attainability) and "is it worth it?" (opportunity) are munged into one filtered-then-scored pass, and the filter *deletes* the interesting options. A counselor first fixes the **realistic consideration set**, then reasons about value **within** it.
- **RC-C — Colleges are scored in isolation; there is no comparison.** The engine never asks "PSG vs CIT — which is the better choice and why?" It scores each college alone and sorts. Counselor judgment is inherently **comparative and pairwise**; that reasoning is structurally absent.
- **RC-D — No domain knowledge; pure data math.** When data is sparse (PSG's row is a blank stub — D5/D6), the engine has *nothing* and PSG sinks. A counselor carries **priors**: they know PSG's reputation without a spreadsheet. The system encodes zero domain knowledge, so it cannot recover from missing data the way an expert does.

**The flagship in these terms:** the engine returned Nehru not because it judged Nehru a better *opportunity*, but because (RC-A) it had no tier to say "Nehru ≪ PSG," (RC-B) it deleted CIT/Kumaraguru as "dream," (RC-C) it never compared survivors head-to-head, and (RC-D) it had no prior to rescue PSG's empty data row — so D3's arithmetic artifact won.

---

## 2. Weaknesses in the Current Engine (mapped to counselor gaps)

| # | Current mechanism | Counselor-reasoning gap |
|---|---|---|
| W1 | Renormalized average over present dimensions ([`scoring-engine.ts:59`](../../lib/recommendation/scoring/scoring-engine.ts#L59)) | Rewards *missing* data; a sparse college outranks a proven one. A counselor never prefers the college they know *less* about. |
| W2 | Selectivity / OC-cutoff explicitly *not* scored ([`executor.ts:32`](../../lib/recommendation/strategies/executor.ts#L32)) | Demand/brand — the counselor's #1 tier signal — is invisible. |
| W3 | Hard-drop of `dream` before scoring ([`executor.ts:95`](../../lib/recommendation/strategies/executor.ts#L95)) | Aspirational colleges vanish; a counselor *always* discusses the stretch. |
| W4 | OC cutoff applied to every community ([`nirf2026-cutoff-lookup.ts:23`](../../lib/recommendation/data/nirf2026-cutoff-lookup.ts#L23)) | Reserved students mis-judged; attainability wrong at the root. |
| W5 | Independent per-college scoring, then sort | No pairwise "A beats B because…" reasoning. |
| W6 | Alphabetical name as ultimate tie-break ([`executor.ts:73`](../../lib/recommendation/strategies/executor.ts#L73)) | Ties resolved by spelling, not judgment. |
| W7 | Confidence = data completeness ([`reason-generator.ts:54`](../../lib/recommendation/reasons/reason-generator.ts#L54)) | Confidence says nothing about how *sure* the counselor is of the *pick*. |
| W8 | Evidence gathered only for *named* colleges, cutoff hardcoded `null` ([`ai-orchestrator.ts:117`](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L117)) | Recommended colleges ship almost no "why." |
| W9 | Mis-joined / duplicated facts (D5/D6) | The engine reasons over *another college's* data. |
| W10 | Reputation, alumni, recruiters, NBA/NAAC, fees, hostel absent from data | The richest counselor signals have no source (must be proxied or curated). |

---

## 3. Proposed Reasoning Architecture

A **seven-layer deterministic pipeline**, each layer a separate, testable module with a single responsibility. This is the strict separation requested (eligibility / scoring / expert reasoning / ranking / evidence / explanation), plus an identity layer and an opportunity-value layer.

```
 L0  IDENTITY & INTEGRITY   dedup entities, correct NIRF joins            (fix D5/D6)
      │  → clean CanonicalCollege with correctly-attributed facts
 L1  HARD ELIGIBILITY        community+branch+quota cutoffs, historical    ("can I realistically get in?")
      │  → CONSIDERATION SET: colleges with band {safe|target|reach} + P(admit)   (NO desirability here)
 L2  OPPORTUNITY VALUE       tier (Elite…Regional) + within-tier score     ("how good is the future?")
      │     data proxies (selectivity, PowerScore, placement, salary, autonomous, govt)
      │     ⊔ curated reputation PRIOR (governed floor for known colleges)
      │  → each college: OpportunityTier + refinedScore + signal breakdown
 L3  EXPERT RULE ENGINE      ordered IF-THEN counselor heuristics          ("apply judgment")
      │     tier-dominance, govt-ROI, autonomous-ecosystem, tie-break ladder, preference overrides
      │  → per-college adjustments + a REASONING TRACE (which rules fired, why)
 L4  COMPARATIVE RANKING     lexicographic pairwise comparator → total order  ("PSG vs CIT vs …")
      │  → ranked consideration set + per-adjacent-pair "why A > B" + counselor SPREAD (2 reach•4 target•2 safe)
 L5  EVIDENCE GENERATION     structured dossier per RECOMMENDED college     (incl. comparative + assumptions)
      │  → EvidencePackage (every number carries a citable id)
 L6  EXPLANATION             deterministic trace → the six "why" answers    → GPT narrates ONLY
```

**Design principles.**
- **Tiers dominate; scores refine; rules arbitrate.** Reputation tier is the primary ordering; the numeric score orders *within* a tier; expert rules decide close/cross-tier calls and encode ROI/preference logic. This is the mathematical shape of "not a spreadsheet."
- **Attainability is a separate axis from desirability.** L1 never looks at quality; L2 never looks at cutoffs. They compose only at L4.
- **Everything is deterministic and versioned.** The rule set, tier thresholds, and curated prior are versioned config with unit tests. No randomness, no LLM in the decision path.
- **Graceful degradation is explicit.** Rules referencing unavailable data (alumni, recruiters, NBA, fees, hostel) are *declared but inactive* until data lands; the engine records the assumption ("reputation from prior; cutoff estimated from OC") rather than silently guessing.

**Module mapping (reuse, don't rebuild):** L0 = knowledge/warehouse (crosswalk fix); L1 = `eligibility-engine` + new community/branch `CutoffLookup`; L2 = new `opportunity/` module beside `scoring/`; L3 = new `reasoning/` module; L4 = extend `strategies/executor` comparator + existing `comparison-engine`; L5 = `reasons/evidence` + orchestrator evidence; L6 = `opinion` + prompt (GPT). Public facade signatures unchanged.

---

## 4. Expert Decision Rules

A **governed, versioned, priority-ordered rule catalog.** Each rule is a pure predicate → effect with a test in the golden set. Rules never call GPT. Effects are one of: `gate` (include/exclude), `tier-floor/ceiling`, `boost/penalty` (bounded), `prefer` (pairwise tie-break), `annotate` (add reasoning/assumption). Availability is honest: **active** (data/proxy exists now), **prior** (via curated seed), or **inactive** (blocked on data — declared for forward-compat).

| ID | Priority | Condition | Effect | Data | Status |
|---|---|---|---|---|---|
| **R0 Eligibility gate** | 100 | student below college's community+branch closing cutoff by > hardMargin | `gate: exclude` (true non-starter) | Ftnea cutoffs | active after bridge |
| **R1 Realistic set** | 95 | band ∈ {safe, target, reach} | `gate: keep`; dream kept only for aspirational slot, labeled | L1 | active |
| **R2 Tier dominance** | 90 | college A tier > college B tier (by ≥1 tier) and both attainable | `prefer A` regardless of marginal score | L2 | active |
| **R3 PSG-class primacy** (generalized) | 88 | an Elite-tier college is attainable (target/safe) and no strictly higher-value college is | that Elite college is the **primary pick** | L2 | active/prior |
| **R4 Government ROI** | 80 | two colleges same tier, placement within ε | `prefer government` (ROI proxy; fees absent) | name-heuristic + placement | active (proxy) |
| **R5 Autonomous ecosystem** | 78 | same tier, similar placement, one autonomous | `prefer autonomous` (placement-ecosystem proxy) | **name "(Autonomous)"** | active (proxy) |
| **R6 Placement-first tie-break** | 70 | same tier, no R4/R5 decision | compare median salary → placement % → careerOutcome | placement/2026 | active |
| **R7 Depth ladder** | 60 | still tied | compare research → faculty → academic reputation | warehouse | active |
| **R8 Brand/alumni/recruiter** | 55 | still tied | compare selectivity percentile (brand proxy) [+ recruiter/alumni when data lands] | OC percentile | active (proxy); full **inactive** |
| **R9 Accreditation** | 50 | still tied | prefer higher NAAC / NBA | accreditation (sparse) | mostly **inactive** |
| **R10 Student preference** | 40 | hard prefs (district/branch/ownership) set | `gate`/`boost` to honor preference | StudentProfile | active |
| **R11 Soft preference** | 30 | still tied | prefer nearer district / lower fee / hostel availability | distance/fees/hostel | **inactive** (blocked) |
| **R12 Attainability comfort** | 25 | choosing the *primary* pick | prefer target/safe over reach for the headline; surface reach as "aspirational" | L1 | active |
| **R13 Assumption honesty** | 10 | OC used for community, or prior used for tier, or data sparse | `annotate` assumption + lower confidence | meta | active |

**Governance:** the catalog is a single versioned file; each rule has (a) a one-line rationale, (b) ≥1 golden test, (c) an availability flag. Adding/retiring a rule is a reviewed PR with a golden-diff. Inactive rules are compiled and tested with synthetic data so they light up automatically when the dataset arrives (M8, deferred).

---

## 5. Ranking Strategy

**Comparative, lexicographic, cycle-free.** Pure all-pairs "voting" (Copeland/Condorcet) can produce non-transitive cycles and is hard to explain; instead we use a **lexicographic comparator** `C(a, b)` that *is* pairwise reasoning but guarantees a stable total order:

```
C(a, b):                                   # both already in the consideration set (L1)
  1. OpportunityTier(a) vs (b)             → higher tier wins            (R2/R3)
  2. same tier → apply the rule ladder in priority order:
        R4 govt-ROI → R5 autonomous → R6 placement → R7 depth → R8 brand → R9 accred → R11 soft
     the FIRST rule that separates them decides — and is RECORDED as the reason
  3. still equal → refinedScore (within-tier numeric)
  4. still equal → stable college id      (never display name — kills W6)
```

- **Total order ⇒ no cycles ⇒ deterministic, reproducible ranking.** Property-tested (§9).
- **The deciding criterion at step 2/3 for each adjacent pair is stored** — this is the raw material for "why is A better than B" (L6), delivering the user's Step 4 pairwise explanations without O(N²) narrative.
- **Primary pick vs aspirational (R3/R12):** the headline recommendation = highest-opportunity college that is **target/safe**. The best **reach**/near-dream Elite college is surfaced separately as *"aspirational — attainable if cutoffs move your way."* → *If PSG is target/safe, PSG is #1. If PSG is a reach, PSG leads the aspirational group and the best realistic college leads the headline.* This is precisely counselor behavior.
- **Output = the counselor spread** (locked decision): default **2 reach • 4 target • 2 safe**, each labeled with band + P(admit), dream shown as clearly-labeled aspirational. Within each band, colleges are ordered by the comparator.
- **Confidence** attaches per recommendation: a function of attainability certainty (cutoff present + low historical volatility), data completeness, and **prior-vs-data agreement** (if the curated prior and the data disagree on tier, confidence drops and the disagreement is surfaced).

---

## 6. Evidence Generation Strategy

Every **recommended** college (not just named ones — fixes W8) emits a structured `CollegeEvidence`; GPT converts, invents nothing (existing numeric/name hallucination guard [`validator.ts:96`](../../lib/ai/llm/validator.ts#L96) retained; add a qualitative-claim guard).

```ts
interface CollegeEvidence {
  college: { name, district, ownership, autonomous }          // ownership/autonomous from name
  attainability: { band, closingCutoff:number, community, pAdmit, volatility, basis }   // real number, not null
  opportunity:   { tier, refinedScore, signals: {selectivityPct, powerScore, medianSalary, placementPct, nirf, ...} }
  comparativeEdge: { over: string, decidedBy: RuleId, delta: string }   // "> Kumaraguru, decided by R2 tier (99th vs 92nd pct)"
  strengths: string[]; tradeoffs: string[]; assumptions: string[]      // assumptions surfaced (OC-fallback, prior-used)
  confidence: { level, basis }
  alternatives: { nearby: string[] }                                    // same district, adjacent band
  unavailable: string[]   // ["fees","recruiters","nba"] — explicit, never fabricated
}
```

Populatable now: attainability (after bridge), tier + signals, comparative edge, strengths/trade-offs/assumptions, confidence, nearby alternatives, autonomous/ownership. Blocked (listed in `unavailable`): fees, recruiters, alumni, NBA, hostel, true highest package, NIRF numeric rank.

---

## 7. Explanation Strategy

The six required "why" answers are generated **deterministically** from the L3 trace + L4 comparator record, then narrated by GPT:

| Question | Deterministic source |
|---|---|
| Why ranked **here**? | tier + attainability band + P(admit): *"Elite tier, attainable as a target (P≈0.78) — the best realistic opportunity in your set."* |
| Why better than the college **below**? | the comparator's `decidedBy` rule: *"Above Kumaraguru — both attainable, but PSG is a higher reputation tier (selectivity 99th vs 92nd pct) with a stronger placement ecosystem (R2)."* |
| What **strengths** decided it? | top opportunity signals (salary, placement, selectivity, autonomous). |
| What **trade-offs**? | weaknesses + reach risk + `unavailable` fields. |
| What **assumptions**? | R13 annotations: *"Community cutoff unavailable — estimated from OC; treat the band as approximate,"* / *"Reputation from curated tier (data sparse for this college)."* |
| How **confident**? | calibrated level + basis (attainability certainty × data completeness × prior-data agreement). |

Worked flagship (BC-190, Coimbatore CSE), post-redesign, headline pick:

> **PSG College of Technology — top pick (aspirational→target).** Elite reputation tier; among the strongest placement ecosystems in Coimbatore. Ranked above Kumaraguru and Sri Krishna because it is a higher reputation tier at comparable attainability (R2). *Assumption: PSG's community cutoff was estimated from historical OC data — confirm on the official counselling portal. Confidence: medium-high.* Aspirational note: CIT is a strong reach if your rank improves.

GPT verbalizes this; it cannot change the ranking or invent a number. **Default depth (DP-3):** concise — strengths/trade-offs + the one deciding reason per college; the full pairwise chain is computed in L5 and shown only on request ("why not CIT?").

---

## 8. Edge Cases

| # | Case | Deterministic handling |
|---|---|---|
| E1 | **PSG has no data row** (D5/D6 stub) | Curated prior sets tier floor = Elite; R13 flags "reputation from prior; data sparse"; confidence lowered. (Full fix = L0 data integrity.) |
| E2 | **Mis-joined facts** (Nehru←KPR) | L0 dedup/attribution; until fixed, prior-vs-data disagreement flag suppresses the inflated signal. |
| E3 | **Duplicate entities** (CIT ×2) | L0 merge by canonical identity; keep the record with cutoff, absorb facts. |
| E4 | **No eligible colleges** (rare) | Relax district → widen band → honest "nothing in your exact filter; here's the closest." Never fabricate. |
| E5 | **Everything is a reach** (very low cutoff) | Present best *attainable* (safe) colleges honestly; label the tier realistically; no false elite promises. |
| E6 | **Very high cutoff** (everything attainable) | Attainability neutral → pure opportunity ranking; elite tier leads. |
| E7 | **Community cutoff missing** | OC fallback + R13 assumption + lower confidence + widened band. |
| E8 | **Volatile historical cutoffs** | Widen band, lower P(admit) certainty, surface volatility in evidence. |
| E9 | **Preference conflict** (wants Chennai; best value in Coimbatore) | Honor hard preference (R10) but surface "outside your district, higher value" as an explicit alternative. |
| E10 | **Govt vs private, fees unknown** | R4 prefers govt on ROI proxy; annotate "fees not in dataset — ROI estimated." |
| E11 | **Branch not offered** | L1 excludes (after branch bridge); pre-bridge, annotate "branch availability unverified." |
| E12 | **Prior vs data disagree** (prior says Elite, data says weak) | Do not silently trust either; lower confidence, surface both, flag for governance review (drift monitor). |
| E13 | **New/unknown college** (not in prior, sparse data) | Rank purely on available data with low confidence; never auto-elite. |
| E14 | **Tie within tier, all signals equal** | Deterministic stable id; explanation says "comparable — either is a sound choice." |
| E15 | **Curated prior staleness** | Governance: prior versioned + reviewed each admission cycle; drift monitor reports prior/data divergence. |

---

## 9. Validation Plan

Ground truth here is ultimately **expert judgment**, so validation blends objective data checks with counselor labels.

1. **Counselor-labeled golden rankings** (the gold standard, ~60–100 scenarios): input profile → expected ranked spread + expected primary pick + expected pairwise winners + expected key reasons + expected confidence. Authored/reviewed by an experienced TN counselor. The flagship and regional tier lists (Coimbatore/Chennai/Madurai/Trichy) anchor this.
2. **Rule unit tests:** each expert rule (R0–R13) has ≥1 minimal scenario proving it fires and its effect; inactive rules tested with synthetic data so they're correct when data arrives.
3. **Tier-assignment tests:** known colleges land in expected tiers; prior-as-floor prevents demotion; data can promote; drift cases flagged.
4. **Comparator property tests:** totality, antisymmetry, **transitivity/cycle-freeness** over randomized profiles (guards the lexicographic design).
5. **Attainability accuracy:** bands vs `Ftnea_cutoffs` community+branch ground truth (objective, auto-derived) — target ≥95%.
6. **Confidence calibration:** predicted vs realized correctness per band, ±10%.
7. **Counselor-agreement metric:** top-1 and top-3 overlap between engine and the labeled panel — the headline production KPI.
8. **A/B vs current engine** on the golden set: quantify improvement (flagship must flip; no regressions).
9. **Regression gates in CI** (the review's M1 harness, extended): top-1/top-3/band/exclusion gates; determinism double-run; **cycle-free** invariant. Wire `vitest` into CI (currently skipped).

---

## 10. Implementation Roadmap

Integrated with the review's approved milestones (M1 measurement-first is locked; M8 data-acquisition deferred). New reasoning layers slot in as M3–M4 and M8-explanation. Each milestone: independently reviewable, independently revertible, public APIs preserved, all 529 tests green.

| M | Milestone | Layer | Delivers | Risk | Depends |
|---|---|---|---|---|---|
| **M1** | Golden + CI harness | — | measurement first; counselor-labeled ranking scenarios + rule-test scaffold; baseline recorded | Low | — |
| **M2** | Scoring realism | L2 base | fixed-denominator + selectivity + PowerScore/salary + min-evidence gate (kills D3/W1/W2) | Low | M1 |
| **M3** | Opportunity Value model | L2 | tiers (Elite…Regional) from proxies **+ governed curated prior (floor)**; autonomous-from-name; drift monitor | Med | M2 |
| **M4** | Expert Rule Engine + Comparative Ranking | L3–L4 | R0–R13 catalog, lexicographic pairwise comparator, spread composition, primary-vs-aspirational (RC-A/C fixed) | Med | M3 |
| **M5** | Soft eligibility & spread | L1 | bands not hard-exclude; 2 reach•4 target•2 safe; dream labeled (D2/W3) | Med | M4 |
| **M6** | Community+branch cutoff bridge | L1 | populate `counsellingCodes`; Ftnea community/branch lookup; branch-scoped candidates (D1/W4) | Med | — |
| **M7** | Identity & data integrity | L0 | dedup entities, correct NIRF joins (D5/D6/W9); fixes PSG/Nehru data | High (upstream) | — |
| **M8** | Evidence + Explanation redesign | L5–L6 | structured `CollegeEvidence` per recommended college; comparative edge; six "why" answers; qualitative guard | Low | M4 |
| **M9** | Monitoring | — | counselor-agreement KPI, calibration, drift, coverage/health dashboards | Low | M8 |
| — | *(M-data — fees/NBA/hostel/recruiters)* | — | **deferred (decision Q4)** — reserved rules/weights stay inactive | — | — |

**Fastest path to the PSG example working end-to-end:** M3 (tier + curated prior floors PSG at Elite) → M4 (tier dominance ranks it top of value) → M5 (spread + aspirational labeling) → M6 (correct BC attainability) → M7 (fixes PSG's blank row so data confirms the prior). The curated prior in M3 is what lets PSG rank correctly *before* M7 lands.

---

## Resolved decisions (locked 2026-07-04)

- **DP-1 — Reputation prior: APPROVED (curated prior + proxies).** A governed, versioned tier seed of well-known TN colleges acts as a **floor** over data-driven tiers, so PSG/CIT/Anna rank correctly even with sparse/blank data rows. Governance: the seed is a single reviewed file, re-validated each admission cycle, with a drift monitor comparing prior-tier vs data-tier (E12/E15). Data may **promote** above the floor but never demote a seeded elite.
- **DP-2 — Ranking shape: tiers dominate, scores refine, rules arbitrate.** Reputation tier is the primary sort key; the numeric score orders only *within* a tier; expert rules decide close/cross-tier calls. Marginal metric accumulation can never flip a tier boundary.
- **DP-3 — Explanation depth: concise + on-demand.** The answer shows strengths/trade-offs and the single deciding reason per college by default; full pairwise "why better than each college below" chains are produced in the evidence layer and surfaced only when the student asks. (L5 always computes the full comparative record; L6 renders it concisely.)
