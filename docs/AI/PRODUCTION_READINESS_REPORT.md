# AI Counselor — Production Readiness Report

**Author:** Principal AI Engineer
**Date:** 2026-07-04
**Branch validated:** `feature/ai-counselor-v2` (commit `61ba00ff`+)
**Verdict:** ⚠️ **CONDITIONAL GO — monitored beta only.** NO-GO for unconditional full public launch until the blockers below are cleared.

> This report is grounded in measured evidence from an automated 214-scenario validation harness, a performance benchmark, and 548 passing tests — all reproducible. Where a production requirement could not be verified in this environment (HTTP load, live monitoring, security), it is marked **UNVERIFIED**, never assumed green.

---

## 1. Production Readiness Score — **70 / 100**

| Dimension | Weight | Score | Evidence / basis |
|---|---:|---:|---|
| Recommendation correctness (engine) | 20 | 18 | Flagship + regional cases counselor-correct; 214-scenario invariants 100% |
| Determinism & reliability (in-process) | 15 | 15 | 100% determinism across 214 scenarios + 200 repeated calls; 0 drift |
| Performance (engine core) | 10 | 10 | p99 0.35 ms, build 103 ms, 61 MB heap |
| Automated test coverage & CI gate | 15 | 13 | 548 tests, blocking CI gate wired; golden regression harness |
| **Real-counselor validation** | 15 | 4 | ⚠️ Framework built; **not executed with real counselors at scale** |
| Data quality & integrity | 10 | 6 | Community cutoffs bridged; residual shared-NIRF-id + missing datasets |
| **Deployment status** | 10 | 3 | ⚠️ Validated code is on a **feature branch, NOT in production** |
| **Live monitoring & observability** | 5 | 1 | ⚠️ Offline metrics only; no production telemetry wired |
| **HTTP load / security** | — | UNVERIFIED | Needs staging env; not testable in this harness |
| **Total** | 100 | **70** | |

**Interpretation:** the deterministic recommendation *core* is production-grade and well-evidenced (correctness, determinism, speed). The score is held back by the *production wrapper*: the improvements aren't deployed, haven't been signed off by real counselors at scale, and lack live monitoring / load / security verification.

---

## 2. Recommendation Accuracy Metrics (measured)

From the automated validation harness (`lib/recommendation/__tests__/golden/validation.test.ts`), **214 scenarios** across all 7 communities, cutoffs 90–200, major branches, 3+ districts, government/private, missing-preference, and edge cases:

| Invariant | Result | Meaning |
|---|---:|---|
| Determinism | **100%** | identical inputs → byte-identical outputs |
| No-hallucination | **100%** | every recommended college exists in the warehouse |
| Eligibility soundness | **100%** | no college surfaces whose community cutoff is beyond the student's reach margin |
| In-district | **100%** | district queries never leak an out-of-district college (M7 fix holds) |
| Ranking contiguity | **100%** | ranks 1..N contiguous, score non-increasing (tier-then-score) |
| Confidence validity | **100%** | every recommendation carries a valid low/medium/high band |

**Ranking-quality (top-k) against known counselor outcomes** — validated on the curated golden locks (flagship + regional). Flagship `CSE/Coimbatore/BC/190` top-6: **Kumaraguru, CIT, GCT, PSG-ITAR, PSG, Sri Krishna** — the expected elite set. Locked as regression tests (`golden/scenarios.ts`).

**Confidence census:** high 186 / low 27 / none 1 (of 214). *Note:* confidence is `dataCompleteness`-banded, so it reflects data coverage of the top pick, not calibrated correctness — see risk R4.

**⚠️ Honesty note:** top-1/3/5 accuracy against a *large* set of real-counselor-labeled rankings is **not** measured — that requires human labels (Phase 4). The invariant metrics above prove the engine is *sound and consistent*; they do not by themselves prove *counselor agreement at scale*.

---

## 3. Performance & Reliability (measured, in-process)

`lib/recommendation/__tests__/golden/performance.test.ts`, real 324-college warehouse:

- **Warehouse build (cold):** ~103 ms, one-time and cached per process.
- **Recommendation latency** (1000 calls): mean 0.086 ms · **p50 0.044 ms · p95 0.251 ms · p99 0.351 ms** · max 1.3 ms.
- **Memory:** ~61 MB heapUsed / ~260 MB rss after build.
- **Stability:** 200 identical calls → byte-identical results (no drift).

The deterministic core adds negligible latency; end-user response time will be dominated by the GPT explanation call + network, not the engine.

**UNVERIFIED (needs staging):** concurrent-user throughput, end-to-end API latency (with GPT), Supabase/DB performance, failover/recovery, HTTP timeout handling.

---

## 4. Real-Counselor Validation Framework (Phase 4 — designed, not executed)

A structured review harness for an experienced TN admission counselor:

- **Input:** each scenario's `StudentProfile` + the engine's ranked recommendations (exportable from the validation harness).
- **Per scenario, the counselor records:** their own expected top-5, an agreement score (top-1 match, top-3 overlap, top-5 overlap), and free-text notes on any disagreement.
- **Output metric — "counselor agreement":** top-1 and top-3 overlap %, aggregated and tracked over time as the headline trust KPI.
- **Seed:** the curated golden locks already encode counselor-consensus for the marquee Coimbatore/Chennai/Madurai/Trichy cases; a review round should extend this to ≥50 labeled scenarios spanning communities and cutoff bands.

**Status:** the harness + export format exist; **the human review round has not been run.** This is blocker B2.

---

## 5. Production Quality Metrics (Phase 5)

| Metric | Status | How |
|---|---|---|
| Recommendation accuracy (invariants) | ✅ Implemented | validation harness, offline/CI |
| Missing-data rate | ✅ Computable | confidence/`dataCompleteness` census (offline) |
| Low-confidence rate | ✅ Measured | 27/214 top picks low-confidence |
| Hallucination rate | ✅ Guarded | numeric/name guard in `lib/ai/llm/validator.ts`; 100% no-hallucination offline |
| Recommendation drift | ⚠️ Partial | golden snapshot diff catches release-to-release drift; needs CI wiring on data changes |
| Acceptance rate | ❌ Needs live traffic | requires a UI selection event → API |
| Confidence calibration | ❌ Not calibrated | needs realized-outcome labels |
| Data-quality issues | ⚠️ Known-list | warehouse stats (`nirfConflicts`), documented gaps |

Offline metrics are implemented and gated; live-traffic metrics require production instrumentation (blocker B4).

---

## 6. Remaining Risks

- **R1 — No counselor sign-off at scale.** Ranking quality is proven on the flagship + a handful of curated cases and by soundness invariants, not by a broad counselor-labeled set. *Impact: medium-high for a "thousands of students" claim.*
- **R2 — Residual data-integrity defects.** The base warehouse still assigns shared NIRF ids to distinct colleges (I fixed the 2026-merge symptom; the root dedup + the CIT duplicate-entity remain). Some colleges' facts may still be mis-attributed. *Impact: medium (localized wrong stats).*
- **R3 — Missing datasets.** Fees, NBA, hostel, recruiters, true highest package are absent, so ROI/affordability/accreditation reasoning is proxied or unavailable; community cutoffs are college-level median (not branch-specific) and cover ~262/492 colleges. *Impact: medium (reduced answer completeness).*
- **R4 — Confidence is not calibrated.** It reflects data coverage, not correctness; only high/low observed (no medium). *Impact: low-medium (mislabels certainty).*
- **R5 — HTTP/load/security unverified** in this phase. *Impact: unknown until staging.*
- **R6 — Security debt.** The Azure/OpenAI key rotation flagged earlier must be confirmed done; no security review was performed in this phase. *Impact: high if unrotated.*

---

## 7. Remaining Blockers (must clear before full public launch)

- **B1 — Deploy the validated engine.** All improvements live on `feature/ai-counselor-v2`; production is running the earlier rolled-back release. **Nothing validated here is live.** → merge to main + deploy + smoke-test.
- **B2 — Counselor validation round.** Execute the Phase-4 review on ≥50 labeled scenarios; target ≥80% top-3 agreement before unconditional launch.
- **B3 — Staging load/security verification.** Concurrent-user + end-to-end latency + DB + failover + timeout tests; confirm key rotation + a basic security review.
- **B4 — Live monitoring.** Wire acceptance, drift, low-confidence, and hallucination-rejection telemetry + a dashboard before exposing to scale.

**Not blockers (acceptable to launch with caveats, roadmap after):** R2 base-warehouse dedup, R3 missing datasets, R4 confidence calibration — provided answers honestly flag missing data (they do) and a monitored beta contains exposure.

---

## 8. Production Readiness Checklist

| Requirement | Status | Evidence |
|---|---|---|
| Recommendation engine validated | ✅ | 214-scenario invariants 100%; flagship counselor-correct |
| Golden dataset passing | ✅ | golden locks + 214-scenario harness green |
| Regression tests passing | ✅ | 548 tests pass; blocking CI gate wired |
| Deterministic behavior | ✅ | 100% determinism, 0 drift |
| Performance (engine) | ✅ | p99 0.35 ms, 61 MB |
| Error handling / fallback | ✅ | deterministic fallback + hallucination guard (existing, tested) |
| Data integrity | ⚠️ | 2026-merge mis-join fixed; base shared-ids + duplicates remain |
| Azure deployment verified | ❌ | validated code **not deployed** (feature branch) — B1 |
| Real-counselor validation | ❌ | framework only — B2 |
| Monitoring configured | ❌ | offline only — B4 |
| Logging configured | ✅ | structured chat logging exists (existing) |
| Load / concurrency verified | ❌ UNVERIFIED | needs staging — B3 |
| Security verified | ❌ UNVERIFIED | key rotation + review pending — B3/R6 |
| Documentation updated | ✅ | design docs + this report + implementation log |

---

## 9. Go / No-Go

**Recommendation: NO-GO for unconditional public launch. CONDITIONAL GO for a monitored beta**, contingent on:

1. **B1** — deploy `feature/ai-counselor-v2` to staging then production, smoke-tested.
2. **B2** — a counselor review round (≥50 scenarios, ≥80% top-3 agreement target).
3. **B4** — live monitoring on acceptance / low-confidence / hallucination / drift.
4. **B3/R6** — confirm key rotation + a basic load & security pass in staging.

**Evidence supporting confidence in the core:** the recommendation engine is deterministic, sound (100% eligibility/in-district/no-hallucination across 214 scenarios), fast (sub-ms), regression-gated (548 tests + blocking CI), and counselor-correct on the flagship and regional tier lists. The architecture keeps GPT to explanation only, so the engine — the source of truth — is fully testable and reproducible.

**Why not unconditional GO:** trusting a system with *thousands* of students requires (a) the validated code to actually be live, (b) real counselor agreement measured at scale, and (c) production monitoring to catch what offline tests cannot. None of those three is complete. A staged beta with a counselor in the loop and monitoring is the responsible path; graduate to full launch once B1–B4 are cleared and counselor agreement clears the bar.

---

## Appendix — Reproduce the evidence

```bash
CYC_DATA_DIR=/path/to/data npm test                     # full suite (548) incl. gated real-data tiers
CYC_DATA_DIR=/path/to/data npx vitest run \
  lib/recommendation/__tests__/golden/validation.test.ts # prints the 214-scenario validation report
CYC_DATA_DIR=/path/to/data npx vitest run \
  lib/recommendation/__tests__/golden/performance.test.ts # prints the performance report
```
