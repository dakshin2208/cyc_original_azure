# Sprint 3 — Recommendation Engine

The deterministic decision layer of the platform. It sits **above** the Sprint 2
Structured Retrieval Engine and the Phase 1 Canonical Knowledge Warehouse and
turns their facts into ranked, explained, confidence-scored recommendations.

> **The engine decides. A future LLM only explains.**
> There is **no** AI, LLM, embeddings, vector search, RAG, chatbot, or prompt
> anywhere in this module. Every output is a pure, deterministic function of the
> warehouse data and the configuration.

---

## 1. Files created

```
lib/recommendation/
├── index.ts                         # Public barrel (single import surface)
├── config.ts                        # Module 8 — ALL weights/thresholds/refs
│
├── models/                          # Module 1 — DTOs (no logic)
│   ├── enums.ts                     #   dimensions, categories, bands, levels
│   ├── profile.ts                   #   CollegeProfile (joined facets)
│   ├── score.ts                     #   DimensionScore, RecommendationScore
│   ├── reason.ts                    #   Evidence, Reason, Confidence, Explanation
│   ├── result.ts                    #   EligibilityAssessment, RecommendationResult
│   ├── request.ts                   #   RecommendationRequest
│   ├── comparison.ts                #   ComparisonResult + parts
│   └── index.ts
│
├── data/                            # Profile assembly (reuses retrieval)
│   ├── institute-type.ts            #   government/private classifier
│   ├── cutoff-lookup.ts             #   injectable CutoffLookup (+ null/table impls)
│   ├── profile-provider.ts          #   assembles + memoizes CollegeProfile
│   └── index.ts
│
├── scoring/                         # Module 2 — College Scoring Engine
│   ├── normalizers.ts               #   pure math + per-dimension extractors
│   ├── scoring-engine.ts            #   weighted, renormalized score
│   └── index.ts
│
├── eligibility/                     # Module 3 — Eligibility Engine
│   ├── eligibility-engine.ts        #   Dream/Reach/Target/Safe/unknown banding
│   └── index.ts
│
├── reasons/                         # Module 6 — Reason Generator (structured)
│   ├── labels.ts                    #   closed label vocabularies
│   ├── evidence.ts                  #   concrete fact extraction
│   ├── reason-generator.ts          #   Explanation + Confidence
│   └── index.ts
│
├── strategies/                      # Module 4 — Strategies
│   ├── executor.ts                  #   shared rank pipeline (DRY, deterministic)
│   ├── strategies.ts                #   the 10 strategies (config-driven specs)
│   └── index.ts
│
├── comparison/                      # Module 5 — Comparison Engine
│   ├── comparison-engine.ts         #   winner + per-dimension breakdown
│   └── index.ts
│
├── facade/                          # Module 7 — Facade (public API)
│   ├── recommendation-engine.ts     #   createRecommendationEngine(...)
│   └── index.ts
│
└── __tests__/                       # Module 9 — Tests
    ├── support.ts                   #   multi-college fixture harness
    ├── config.test.ts
    ├── normalizers.test.ts
    ├── scoring.test.ts
    ├── eligibility.test.ts
    ├── strategies.test.ts
    ├── comparison.test.ts
    ├── facade.test.ts
    └── production-data.smoke.test.ts  # opt-in real-data integration (CYC_DATA_DIR)
```

**30 source files (~1,830 LOC) · 9 test files (~765 LOC) · 205 tests.**

---

## 2. Architecture

Four strictly-layered tiers; every arrow points **down** (verified acyclic by
`madge`). This module never modifies Phase 1 or Sprint 2 — it only consumes them.

```
┌─────────────────────────────────────────────────────────────────┐
│  Sprint 3 — RECOMMENDATION ENGINE  (lib/recommendation)          │
│                                                                   │
│   facade ── RecommendationEngine (recommend*, compareColleges)    │
│      │                                                            │
│      ├── strategies ── executor (score→filter→sort→explain→elig)  │
│      ├── comparison ── ComparisonEngine                           │
│      ├── scoring ───── ScoringEngine (9 independent dimensions)   │
│      ├── eligibility ─ EligibilityEngine (CutoffLookup injected)  │
│      ├── reasons ───── ReasonGenerator (STRUCTURED, not prose)    │
│      └── data ──────── ProfileProvider (assembles CollegeProfile) │
│                             │                                     │
│   config.ts ── every weight/threshold/reference (no hardcoding)   │
└─────────────────────────────┼─────────────────────────────────────┘
                              ▼   (reuses; never modifies)
┌─────────────────────────────────────────────────────────────────┐
│  Sprint 2 — RETRIEVAL ENGINE  (lib/retrieval)                     │
│    PlacementSummary · FinanceSummary · ResearchSummary ·          │
│    FacultySummary · InstitutionProfile · fuzzy college lookup     │
└─────────────────────────────┼─────────────────────────────────────┘
                              ▼   (reuses; never modifies)
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1 — CANONICAL KNOWLEDGE WAREHOUSE  (lib/knowledge)         │
│    Immutable canonical entities + read-only repositories          │
└─────────────────────────────────────────────────────────────────┘
```

**Design principles enforced**

- **Determinism** — no `Date.now`, no `Math.random`; every tie is broken by a
  total order (`total → dataCompleteness → name → id`). Same input ⇒ same output.
- **No hardcoding** — all weights, normalization references, eligibility margins,
  confidence bands, and reason thresholds live in `config.ts` and are overridable
  via a deep-merged partial.
- **Independent criteria** — each of the 9 scoring dimensions is computed from its
  own raw metrics in isolation (`scoring/normalizers.ts`).
- **Graceful missing data** — a missing dimension is *renormalized out*, never
  scored as zero. Confidence then reflects how much data backed the decision.
- **Structured, not natural language** — reasons are `{dimension, summary,
  strength, evidence[]}` objects; a future LLM renders them to prose.
- **DRY strategies** — all 10 strategies share one ranking pipeline; each is just
  a `{category, weights, accepts?, requires?, notes?}` spec.

---

## 3. Recommendation flow

```
recommendBestPlacement({ limit: 5, studentCutoff?, community? })
        │
        ▼
  strategyFor('best_placement')          ← weights = config.strategyWeights[cat]
        │
        ▼   rankProfiles(ctx, spec, request)   [strategies/executor.ts]
        │
        ├─(1) ProfileProvider.listProfiles()   → CollegeProfile[]  (reuses retrieval)
        ├─(2) accepts filter                   → e.g. private/government only
        ├─(3) ScoringEngine.score(p, weights)  → 9 DimensionScores + renormalized total
        ├─(4) requires filter                  → drop colleges lacking the focal dimension
        ├─(5) sort by deterministic total order
        ├─(6) slice to limit
        └─(7) per result:
                 ReasonGenerator.explain()  → headline + structured reasons + evidence
                 ReasonGenerator.confidence()→ level from data completeness
                 EligibilityEngine.assess()  → Dream/Reach/Target/Safe/unknown (if cutoff+community)
        ▼
   RecommendationResult[]  (rank, score, explanation, confidence, eligibility, notes)
```

---

## 4. Public API (facade)

```ts
const warehouse  = buildWarehouse(sources)          // @/lib/knowledge
const repos      = createRepositories(warehouse)    // @/lib/knowledge
const retrieval  = createRetrievalEngine(repos)     // @/lib/retrieval
const engine     = createRecommendationEngine(repos, retrieval, { cutoffs? })

// Dimension-focused rankings
engine.recommendBestCollege({ limit })
engine.recommendBestPlacement({ limit })
engine.recommendBestFaculty({ limit })
engine.recommendBestResearch({ limit })
engine.recommendBestInfrastructure({ limit })
engine.recommendBestROI({ limit })
// Ownership-filtered rankings
engine.recommendGovernmentColleges({ limit })
engine.recommendPrivateColleges({ limit })
// Context / eligibility
engine.recommendByBranch(branch, { limit })
engine.recommendByCutoff(cutoff, community, { limit })
engine.recommendSafeColleges(cutoff, community, { limit })
engine.recommendTargetColleges(cutoff, community, { limit })
engine.recommendReachColleges(cutoff, community, { limit })
engine.recommendDreamColleges(cutoff, community, { limit })
// Comparison + generic dispatch
engine.compareColleges(['PSG College of Technology', 'Anna University'])
engine.recommend({ category, limit, branch?, studentCutoff?, community? })  // generic

// higher_studies + government_jobs strategies exist and are reached via
// engine.recommend({ category: 'higher_studies' | 'government_jobs' }).
```

---

## 5. Scoring dimensions (9)

| Dimension            | Raw source (retrieval)                    | Normalization                     |
|----------------------|-------------------------------------------|-----------------------------------|
| placement            | median salary + placement %               | salary/ref blended with rate/100  |
| faculty              | PhD ratio + retention + size              | blended ratios, size/ref          |
| research             | patents + sponsored projects + PhDs       | each /ref, blended                |
| infrastructure       | capital expenditure                       | capex/ref                         |
| financialStrength    | operating expenditure                     | opex/ref                          |
| academicReputation   | PhD scholars pursuing (NIRF)              | scholars/ref                      |
| nirfPresence         | `hasNirfData` (always known)              | 1 or 0                            |
| availableBranches    | *no per-college linkage (see §7)*         | always unbacked → renormalized out|
| dataCompleteness     | # of 5 fact facets present (always known) | present/5                         |

The **total** is the weighted average over only the dimensions with data.

---

## 6. Validation report

| Check | Command | Result |
|-------|---------|--------|
| Production type-check (`strictNullChecks`) | `tsc --noEmit` | **0 errors** in `lib/recommendation` |
| Test type-check | `tsc -p tsconfig.test.json` | **0 errors** |
| No `any` | grep + strict tsc | **none** — fully typed, `readonly` DTOs |
| Circular dependencies | `madge --circular` (3 layers, alias-resolved) | **none** |
| Unit + integration tests | `vitest run` | **222 passed / 2 skipped** (opt-in smokes) |
| Recommendation module tests | `vitest run lib/recommendation` | **70 passed** (68 unit + 2 real-warehouse) |
| No AI/LLM/vector imports | `grep` audit | **0 matches** |
| External deps | import audit | only `@/lib/knowledge`, `@/lib/retrieval` |
| Real production data | `CYC_DATA_DIR=… vitest` | **324 colleges**, all 16 methods, deterministic |

### Test summary (68 unit + 2 real-warehouse smoke)

- `config` (6) — defaults, emphasis, deep-merge, immutability of defaults
- `normalizers` (4) — clamp/ratio/normalizeToRef/blend edge cases
- `scoring` (8) — independent dimensions, exact values, renormalization,
  data-completeness, weight response, determinism
- `eligibility` (6) — all five bands + boundaries + missing-data → unknown
- `strategies` (12) — ranking, private/government filters, **best-placement
  excludes no-placement colleges**, confidence, limits, tie determinism
- `comparison` (6) — 2-way & N-way, dimension winners, strengths/weaknesses, ties
- `facade` (8) — eligibility bands, name resolution, honest-empty, wiring
- `facade-api` (10) — **all 16 public methods** exist + return correctly-tagged
  well-formed rankings; the 5 completion methods; disjoint govt/private
- `explanations` (8) — confidence banding at thresholds, structured reasons +
  evidence, contribution ordering, embedded confidence
- `production-data.smoke` (2, opt-in) — full stack + every public method over the
  real 324-college warehouse

### Real production-data demonstration (324 colleges)

```
BEST PLACEMENT (top 3)   Mahalakshmi Engineering College · Anna University · Rathinam Technical Campus
BEST RESEARCH (top 3)    Anna University · Bharathidasan University · Mahalakshmi Engineering College
Data coverage            placement 206 · finance 206 · research 207 · faculty 306 · nirf 306 · government 14
Determinism              two identical runs → byte-identical ranking ✓
```

---

## 7. Production-readiness assessment

**Ready for production** as the deterministic decision layer, with these honest,
data-driven caveats carried as machine-readable `notes`/`basis` on every result:

1. **Eligibility needs a cutoff dataset.** The warehouse has no per-college
   closing cutoffs (Knowledge Audit: TNEA↔NIRF bridge pending). The engine ships
   with `nullCutoffLookup` (→ `unknown`) and an injectable `CutoffLookup`; wire a
   real `Ftnea_cutoffs.csv`-backed lookup to activate Dream/Reach/Target/Safe. No
   engine code changes required.
2. **Branch-level ranking is unavailable.** No per-college branch linkage exists,
   so `availableBranches` is renormalized out and `recommendByBranch` ranks across
   all colleges with an explicit note. Wire a branch-college dataset to enable it.
3. **ROI omits fees.** No tuition data in the dataset; ROI is a placement-return
   proxy, flagged on every result.
4. **Government/private is a name heuristic.** With no ownership field, colleges
   are classified by configured name fragments. State universities without a
   matching fragment (e.g. "Bharathidasan University") default to *private*. Add
   an ownership column to the dataset for exact classification.

None of these are engine defects — they are data-availability limits, surfaced
transparently rather than hidden behind a guessed number.
