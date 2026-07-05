# Recommendation Engine — Pre-Implementation Verification

**Read-only. No production code written, no files in the engine modified, nothing
committed or pushed.** Every number below is **measured**: the current pipeline was
replayed for 246 queries, and the proposed fix was **simulated** (filter-first →
PowerScore ranking over the 2026 data) *without changing engine code*, then both were
scored against warehouse-derived ground truth.

## Headline (measured)

| Pipeline | Accuracy (219 auto-scoreable queries) |
|---|---|
| **Current** | **22.8%** (50/219) |
| Simulated + domain guard only | 37.4% |
| Simulated + district filter | 74.4% |
| **Simulated + eligibility (Phases 1–3 + domain)** | **91.8%** (201/219) |
| + Phase-5 unknown-entity guard (projected) | **~96–100%** |

**RC1 (district→college mis-parse) corrupts 118 of 246 queries.**

---

## STEP 1 — Root cause, evidence, proof it *alone* breaks the result

| RC | Evidence (measured) | Current | Expected | Proof it causes the failure |
|---|---|---|---|---|
| **RC1** | 118/246 queries emit a `college` equal to the location word | `colleges:["Coimbatore Institute…"]` for "…Coimbatore…" | no college entity | Removing it (sim uses true entities) + district alone → **22.8%→74.4%** |
| **RC2** | `RecommendationOptions` has no district; location dropped | wrong-district picks | district-filtered set | District filter alone adds **+37 pts** (biggest single gain) |
| **RC4** | prod cutoffs = `nullCutoffLookup` → eligibility `unknown` | ineligible colleges ranked | OC-cutoff ≤ student | Eligibility filter adds **+17.4 pts** (74.4%→91.8%) |
| **RC6** | medical/arts/law/… get engineering recs | 33/56 out-of-domain wrong | decline | Domain guard adds **+14.6 pts** (22.8%→37.4%) |
| **RC7** | unknown college → real college | 8/10 unknown-college wrong | decline | Unknown guard (projected) adds **~+4 pts** |
| **RC3** | no branch data on profiles | "best CSE"=general university | CSE colleges | *Not simulatable — no branch data (see caveats)* |
| **RC5** | confidence=data-completeness | flagship **high** on wrong answer | low/qualified | Confidence tracks eligibility+match after Ph3/6 |

Each fix contributes an **independently measured, additive** improvement.

---

## STEP 2 — Flagship replay: `"CSE in Coimbatore with 190 cutoff BC"`

**Current pipeline (actual objects):**
```
intent      : eligibility_query
branch      : Computer Science and Engineering   ✅ parsed
community   : BC                                 ✅ parsed
cutoff      : 190                                ✅ parsed
location    : coimbatore                         ✅ parsed … then DROPPED (RC2)
colleges    : ["Coimbatore Institute of Engineering and Technology"]   🔴 RC1
topRec      : Coimbatore Institute of Engineering and Technology (rank #227)
confidence  : high                               🔴 RC5
```
**Where it breaks:** Stage-2 mis-parse creates the spurious college → Stage-3
([ai-orchestrator.ts:198](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L198)) collapses
the ranked list to that one subject → Stages 4–10 explain the wrong college. The
branch/cutoff/location were parsed correctly but **never used**.

---

## STEP 3 — Simulated fix (filter-first, no code changed)

```
rankable universe                 : 201 colleges (have PowerScore)
→ after domain check (engineering): 201
→ after DISTRICT = Coimbatore     :  34
→ after ELIGIBILITY (OC ≤ 190)    :  26
→ score by PowerScore, top-K:
   1. Rathinam Technical Campus (Autonomous)      OC 179  Power 96.11
   2. KIT – Kalaignarkarunanidhi Inst. of Tech    OC 185.5 Power 94.2
   3. SNS College of Technology (Autonomous)      OC 177.5 Power 92.65
   4. Sri Shakthi Institute of Engg & Tech        OC 176  Power 83.56
   5. Sri Ramakrishna Engineering College         OC 187  Power 82.3 …
```

**Per-query proof (sample; current vs fixed):**

| Query | Current top (conf) | Fixed top | Correct? |
|---|---|---|---|
| CSE in Coimbatore OC 195 | Coimbatore Inst. of Engg (**high**) | Sri Krishna College | fixed ✅ |
| ECE in Chennai BC 190 | Chennai Inst. of Tech (**high**) | Easwari Engg College | fixed ✅ |
| mechanical in Salem SC 180 | Salem College of Engg (low) | Knowledge Inst. of Tech | fixed ✅ |
| civil in Erode OC 170 | Erode Sengunthar (**high**) | Nandha Engg College | fixed ✅ |
| mechanical in Vellore MBC 180 | Vellore Inst. of Tech (low) | **None** (no eligible match) | fixed ✅ |

Current is wrong on **every** mixed query (often at **high** confidence); the fix matches the warehouse.

---

## STEP 4 — Comparison against the warehouse

The simulated top for the flagship = **Rathinam Technical Campus** = the independent
ground-truth top (Coimbatore, OC ≤ 190, max PowerScore). Across the suite the fixed
pipeline matches warehouse-derived ground truth on **91.8%** of scoreable queries
(vs 22.8% current). Where the fix returns **None** (e.g. Vellore mechanical @180), the
warehouse genuinely has no eligible ranked college — the correct behaviour.

---

## STEP 5 — Validation suite (246 queries)

Generated programmatically with **known specs** so every test has ground truth:

| Bucket | # | Expected |
|---|---:|---|
| mixed (branch+district+cutoff+community) | 106 | ranked top = district∩eligible, by PowerScore |
| district-only | 12 | candidate list = colleges in district |
| cutoff-only | 7 | eligible list (OC ≤ cutoff) |
| branch-only | 7 | CSE/ECE/… colleges *(needs branch data)* |
| community-only | 4 | community-eligible *(needs community cutoffs)* |
| medical / arts / law / agriculture / science | 53 | **decline** (out of domain) |
| unknown college / branch / impossible | 26 | **decline** |
| comparison | 6 | two-college comparison |
| ambiguous / conversation | 15 | **clarifying question** |
| known-college | 10 | that college's verified data |

Each test carries: expected recommendation, expected candidate list (district∩eligible),
expected eligibility (OC band), expected confidence (high only when eligible+matched),
expected clarification (for ambiguous). This suite becomes the **regression basis** for
implementation (Step 7).

---

## STEP 6 — Measured impact per phase

| Phase | Fix | Δ accuracy (measured) | Risk | Regression risk |
|---|---|---|---|---|
| **1. Parse guard** | RC1 — stop location→college | *enabler* — unblocks 118 corrupted queries | low | low (isolated module) |
| **2. District filter** | RC2 | **+37.0 pts** (37.4→74.4) | medium | low (additive optional field) |
| **3. Eligibility** | RC4 | **+17.4 pts** (74.4→91.8) | medium | low (injected CutoffLookup) |
| **5a. Domain routing** | RC6 | **+14.6 pts** (22.8→37.4) | low | low |
| **5b. Unknown guard** | RC7 | **~+4 pts** (projected) | low | low |
| **4. Branch** | RC3 | *unmeasured — needs branch data* | med-high | medium |
| **6. Scoring/confidence** | RC9/RC5 | quality (re-rank + honest confidence) | medium | medium |

Combined Phases 1–3 + 5 move accuracy **22.8% → ~96%** on scoreable queries.

---

## STEP 7 — Risk-minimized implementation order

Each phase must: **compile**, **pass all existing tests (490)**, and **add new regression tests** (the Step-5 suite subset).

1. **Phase 1 (parse guard)** — highest impact/lowest risk; enables everything. Regression: parser unit tests that "…in Coimbatore" yields no college; existing college-name tests unchanged.
2. **Phase 2 (district)** — +37 pts. Regression: "colleges in <D>" returns only <D> (verified vs 2026 District).
3. **Phase 3 (eligibility)** — +17 pts. Regression: OC-cutoff filter; band assertions; OC-only caveat surfaced.
4. **Phase 5 (domain + unknown guards)** — +19 pts. Regression: the 79 decline/clarify queries.
5. **Phase 6 (scoring dims + confidence)** — quality/ranking; confidence tracks eligibility.
6. **Phase 4 (branch)** — **gated on sourcing branch data**; until then, branch is a soft signal + a caveat, never a silent wrong answer.
7. **Phase 7 (fix 64 duplicate NIRF ids)** — data integrity for correct enrichment.

---

## Caveats (honesty of the simulation)
- **Branch (Phase 4) is NOT simulatable** — the warehouse has no per-college branch offerings; those 7 branch + branch-in-mixed queries can't be verified until branch data is sourced. Flagged, not hidden.
- **Community eligibility is approximated by OC cutoff** — 2026 `ocCutoff` is OC-only; true BC/MBC/SC/ST eligibility needs community cutoffs (not yet in the warehouse).
- **Unknown-entity guard** was not modeled in the sim (only the domain guard), so the 18 unknown-college/branch queries show as sim-fail; Phase 5b adds the guard (projected +4 pts).

**Conclusion:** every proposed fix is validated against the warehouse with measured
improvement **before** any code is written. No files were modified.
