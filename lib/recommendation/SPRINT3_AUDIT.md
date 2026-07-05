# Sprint 3 — Recommendation Engine · Completion Audit

Status: **COMPLETE**. Pure deterministic decision engine. No RAG, embeddings,
vector DB, chatbot, prompts, or LLM reasoning — verified by grep audit.

---

## 1. Architecture Review

The Recommendation Engine is the top of a strictly one-directional, four-tier
stack. It **reads** Phase 1 (warehouse) and Sprint 2 (retrieval); it **modifies
neither** (verified — the only external imports are `@/lib/knowledge` and
`@/lib/retrieval`).

```
facade ─┬─ strategies ─ executor (score → filter → sort → explain → assess)
        ├─ comparison
        ├─ scoring     (9 independent dimensions, weighted renormalized total)
        ├─ eligibility (injected CutoffLookup → Dream/Reach/Target/Safe/unknown)
        ├─ reasons     (STRUCTURED explanation + confidence; no prose)
        └─ data        (ProfileProvider: assembles + memoizes CollegeProfile)
config.ts — every weight / threshold / reference (nothing hardcoded downstream)
        ▼ reuses, never mutates
Sprint 2 Retrieval  ▼ reuses, never mutates  Phase 1 Warehouse
```

**Design invariants (all enforced & tested):**

| Invariant | How it is guaranteed |
|-----------|----------------------|
| Determinism | No `Date`/`Math.random`; total order `total → dataCompleteness → name → id`. Byte-identical across runs on the real 324-college warehouse. |
| No hardcoding | All weights/refs/thresholds in `config.ts`; `resolveConfig(partial)` deep-merges overrides. |
| Independent criteria | Each of 9 dimensions computed from its own raw metrics in `scoring/normalizers.ts`. |
| Graceful missing data | Missing dimension renormalized out of the denominator (never scored 0); confidence reflects completeness. |
| Structured, not NL | Reasons are `{dimension, summary, strength, evidence[]}`; a future LLM renders prose. |
| DRY strategies | 10 strategies share one ranking pipeline; each is a `{category, weights, accepts?, requires?, notes?}` spec. |
| Dependency injection | `createRecommendationEngine(repos, retrieval, {config?, cutoffs?})` — all collaborators constructor-injected; `CutoffLookup` swappable. |

**This session's change:** the facade was completed from 11 → **16 public
methods**. The five previously reachable only via generic `recommend({category})`
— `recommendBestFaculty`, `recommendBestResearch`, `recommendBestInfrastructure`,
`recommendGovernmentColleges`, `recommendPrivateColleges` — are now first-class
intent methods. A shared `forward()` mapper removed per-method option-spread
duplication. No engine/strategy/scoring logic changed — those were already
complete and correct.

---

## 2. Files Created / Modified this session

| File | Change |
|------|--------|
| `facade/recommendation-engine.ts` | **Modified** — added 5 intent methods + `forward()` helper; interface extended to 16 methods |
| `__tests__/facade-api.test.ts` | **Created** — 10 tests: full API surface + 5 completion methods |
| `__tests__/explanations.test.ts` | **Created** — 8 tests: confidence banding + structured explanations |
| `__tests__/production-data.smoke.test.ts` | **Modified** — added a 2nd case exercising all 16 methods on the real warehouse |
| `README.md` | **Modified** — API list + validation/test summary updated |
| `SPRINT3_AUDIT.md` | **Created** — this report |

All other 28 source files and 8 test files from the prior session were audited
and left unchanged (no recreation).

---

## 3. Directory Tree

```
lib/recommendation/
├── index.ts                         # public barrel
├── config.ts                        # Module 8 — all weights/thresholds/refs
├── README.md · SPRINT3_AUDIT.md
├── models/                          # Module 1 — DTOs only
│   ├── enums.ts profile.ts score.ts reason.ts
│   ├── result.ts request.ts comparison.ts index.ts
├── data/                            # profile assembly (reuses retrieval)
│   ├── institute-type.ts cutoff-lookup.ts profile-provider.ts index.ts
├── scoring/                         # Module 2
│   ├── normalizers.ts scoring-engine.ts index.ts
├── eligibility/                     # Module 3
│   ├── eligibility-engine.ts index.ts
├── reasons/                         # Module 6
│   ├── labels.ts evidence.ts reason-generator.ts index.ts
├── strategies/                      # Module 4
│   ├── executor.ts strategies.ts index.ts
├── comparison/                      # Module 5
│   ├── comparison-engine.ts index.ts
├── facade/                          # Module 7
│   ├── recommendation-engine.ts index.ts
└── __tests__/                       # Module 9  (10 files, 70 tests)
    ├── support.ts
    ├── config.test.ts normalizers.test.ts scoring.test.ts
    ├── eligibility.test.ts strategies.test.ts comparison.test.ts
    ├── facade.test.ts facade-api.test.ts explanations.test.ts
    └── production-data.smoke.test.ts   (opt-in: CYC_DATA_DIR)
```

**30 source files (~1,847 LOC) · 11 test files (~1,049 LOC).**

---

## 4. Tests Added

+18 unit tests + 1 real-warehouse smoke case (net; module total **70**).

- **`facade-api.test.ts` (10):** all 16 methods are callables; every ranking
  method returns a well-formed, correctly-tagged result; each of the 5 completion
  methods (faculty/research/infra require their data; govt only government;
  private excludes government); generic dispatch reaches `higher_studies` /
  `government_jobs`; limit honoured; determinism.
- **`explanations.test.ts` (8):** confidence bands exactly at the configured
  thresholds (0.75 high / 0.45 medium) incl. boundaries; value + `basis` format;
  real high/low tracking; structured reasons (short label, no sentences);
  concrete numeric evidence; contribution-descending order; embedded confidence
  equals the surfaced confidence.
- **`production-data.smoke.test.ts` (+1):** every public method over the real
  324-college warehouse; dimension methods only rank colleges with that data;
  government ∪ private = all colleges and are disjoint; comparison over real top-5.

---

## 5. Validation Results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript (app, `strictNullChecks`) | `tsc --noEmit --incremental false` | **0 errors** in `lib/recommendation` |
| TypeScript (tests) | `tsc -p tsconfig.test.json --noEmit` | **0 errors** |
| `any` detection | `grep` (source + tests) | **0** |
| Circular dependencies | `madge --circular` (reco+retrieval+knowledge, alias-resolved) | **none** (140 files) |
| Full test run | `vitest run` | **222 passed / 2 skipped** (41 files) |
| Recommendation module | `vitest run lib/recommendation` | **70 passed** |
| Real warehouse build | `buildWarehouseFromDirectory` | **324 colleges / 324 profiles** |
| Smoke — every public method | `CYC_DATA_DIR=… vitest` | **pass**, deterministic ✓ |
| No AI/LLM/vector/embedding/prompt in impl | `grep` | **0** (only doc-comment negations) |

---

## 6. Coverage Summary

No line-coverage tool is installed (see Technical Debt); coverage is reported
functionally — every module and behaviour has direct tests:

| Module | Tested behaviours |
|--------|-------------------|
| config | defaults present for all 9 dims × 12 categories; `emphasize`; deep-merge; default immutability |
| scoring/normalizers | clamp/ratio/normalizeToRef/blend incl. zero/negative/null refs |
| scoring/engine | exact dimension values, weighted total ∈ [0,1], renormalization, data-completeness, weight response, determinism |
| eligibility | safe/target/reach/dream + boundaries + null-cutoff → unknown + injected table |
| reasons | confidence banding + boundaries; structured reasons; evidence; ordering |
| strategies | all 10 ranked; private/government filters; `requires` data-presence; ties; limits; determinism |
| comparison | 2-way, N-way, dimension winners, strengths/weaknesses, ties, determinism |
| facade | all 16 methods; eligibility bands; band re-numbering; name resolution; honest-empty; config/DI wiring |
| real warehouse | full stack + all methods + disjoint partition over 324 colleges |

Untested-by-design: `production-data.smoke` skips unless `CYC_DATA_DIR` is set
(keeps `npm test`/CI hermetic).

---

## 7. Production Readiness Assessment

**Ready to ship** as the deterministic decision layer. It is fully typed
(no `any`), acyclic, deterministic, config-driven, DI-based, and verified against
real production data. Every limitation below is a **data-availability** gap
surfaced transparently via machine-readable `notes`/`basis`, not a code defect —
none blocks deployment; each is activated by supplying data, with **zero engine
changes**.

---

## 8. Known Data Limitations

1. **No closing-cutoff dataset.** Eligibility ships with `nullCutoffLookup`
   (→ `unknown`); Dream/Reach/Target/Safe activate the moment a real
   `CutoffLookup` is injected (`createTableCutoffLookup` provided).
2. **No per-college branch linkage.** `availableBranches` is renormalized out and
   `recommendByBranch` ranks across all colleges with an explicit note.
3. **No fees data.** ROI is a placement-return proxy, flagged on every result.
4. **No ownership field.** `government`/`private` is a config-driven name-keyword
   heuristic; state universities without a matching fragment default to private
   (e.g. "Bharathidasan University").
5. **TNEA↔NIRF bridge partial** (inherited from Phase 1 audit): 209/324 colleges
   NIRF-linked → dimensions needing NIRF facts are `null` for the rest and cleanly
   renormalized out, with confidence lowered accordingly.

---

## 9. Technical Debt

- **No line-coverage tooling** (`@vitest/coverage-v8` not installed). Functional
  coverage only. *Low priority — would require adding a dev dependency.*
- **Scores recomputed per call.** `ProfileProvider` memoizes *profiles*, but each
  strategy call re-scores from scratch. Fine at N=324 (sub-ms); a score cache
  keyed by `(collegeId, weightsHash)` would matter at ≫10k colleges or high QPS.
- **Comparison uses fixed `config.weights`** (best-overall), not a
  per-request category weight profile. Intentional for now; parameterizable later.
- **`DeepPartial` is one level.** Overriding one category's `strategyWeights`
  replaces that category's whole weight map (documented behaviour), not a
  per-dimension merge.
- **`byBand` ranks all colleges then filters.** O(N log N) with N=324 — negligible;
  a cutoff-indexed lookup would help only at large scale.

None are correctness issues; all are documented and localized.

---

## 10. Performance Notes

- **In-memory, synchronous, no I/O** in the engine (warehouse is pre-built).
- **Profile assembly:** memoized per `college.id` — each profile built once, O(1)
  thereafter. `listProfiles()` warms all 324 on first ranking.
- **Scoring:** O(9) per college ⇒ O(9·N) per ranking; **sort** O(N·log N).
- **Measured:** the real-warehouse smoke runs the *entire* stack (CSV parse →
  warehouse build → retrieval → all 16 recommendation methods + comparison) in
  ~230 ms; the recommendation calls themselves are sub-millisecond. Two identical
  rankings over 324 colleges are byte-identical.
- **Memory:** one frozen `CollegeProfile` per college held in the provider cache;
  results are plain immutable objects.

---

## 11. Future Extension Points

| To enable | Do this — no engine change |
|-----------|----------------------------|
| Dream/Reach/Target/Safe | Inject a real `CutoffLookup` via `createRecommendationEngine(…, { cutoffs })` |
| Branch filtering + `availableBranches` | Supply a branch↔college dataset; wire into `ProfileProvider` + a branch `accepts` filter |
| Exact ownership classification | Add an ownership column; replace `classifyInstituteType` source |
| True ROI (with fees) | Add a fees facet; extend the ROI normalizer + weights |
| Tune ranking behaviour | Pass `options.config` (weights/thresholds/refs deep-merged) |
| A new strategy | Add category to `enums` + `strategyWeights` + `STRATEGIES` (≈3 lines) |
| A new scoring dimension | Add to `SCORE_DIMENSIONS` + an extractor + a weight |
| **Sprint 4 — LLM explanations** | Consume the already-emitted `RecommendationExplanation` (headline + structured reasons + evidence + confidence) and render prose. The engine decides; the LLM only explains. |

---

**Stopping here. Awaiting Sprint 4.**
