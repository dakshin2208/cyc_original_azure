# Data Quality Report — `2026_final_NIRF_data.csv`

Computed from the real file + merge (`warehouse.nirf2026`). This is a diagnostic of
the source data; **no data was modified**.

## Totals

| Metric | Value |
|---|---:|
| Source rows | 492 |
| Rows skipped (no college name) | 0 |
| Columns | 19 |
| Normalized profiles | 492 |
| Existing warehouse colleges | 324 |
| Colleges enriched by 2026 data | **262 (80.9%)** |
| Colleges still without a 2026 profile | 62 |
| 2026 rows not linkable to a college | 194 |

## Duplicate rate

| Kind | Count | Rate |
|---|---:|---:|
| Distinct college names (of 492) | 474 | — |
| **Source name collisions** (same name ≥2 rows) | 18 | **3.7%** |
| **Merge duplicate rows** (college seen twice → de-duplicated) | 36 | 7.3% |
| **Duplicate colleges in the warehouse** | **0** | **0%** ✅ |

## Coverage (non-blank cells, of 492 rows)

| Dimension | Present | Coverage |
|---|---:|---:|
| **District** | 431 | **87.6%** |
| **Cutoff** (`ocCutoff`, OC closing marks) | 366 | **74.4%** |
| **Salary** (`avgMedianSalary`) | 202 | **41.1%** |
| **Placement** (`avgPlacementPercentage`) | 202 | **41.1%** |
| Pass % / Higher-studies % / Career outcome | 202 | 41.1% |
| PowerScore | 201 | 40.9% |
| Total intake | 205 | 41.7% |
| CollegeCode | 467 | 94.9% |
| NIRF Code | 206 | 41.9% |

**Read:** the dataset is effectively **two tiers** — ~202 fully-profiled colleges
(NIRF-ranked, with salary/placement/scores) and ~290 rows carrying only
identity + district + (often) cutoff. Salary/placement/score coverage ≈ 41%; district
and cutoff coverage are much higher (88% / 74%).

## Coverage by district

38 distinct districts (+ 61 rows with a blank district). Top districts by row count:

| District | Rows | District | Rows |
|---|---:|---|---:|
| *(blank)* | 61 | Salem | 17 |
| Coimbatore | 56 | Kancheepuram | 15 |
| Chennai | 56 | Thiruvallur | 15 |
| Tiruchirappalli | 29 | Tirunelveli | 14 |
| Kanyakumari | 27 | Erode | 13 |
| Namakkal | 22 | Chengalpattu | 12 |

## Missing values (blank cells per field, of 492)

| Field | Missing | % | Field | Missing | % |
|---|---:|---:|---|---:|---:|
| `powerScore` | 291 | 59% | `nirfCode` | 286 | 58% |
| `avgSeatsFilled` | 291 | 59% | `instituteName` | 286 | 58% |
| `avgMedianSalary` | 290 | 59% | `totalIntake` | 287 | 58% |
| `avgPlacementPercentage` | 290 | 59% | `ocCutoff` | 126 | 26% |
| `careerOutcome` | 290 | 59% | `district` | 61 | 12% |
| `idleOutputIndex` | 290 | 59% | `collegeCode` | 25 | 5% |

## Data-quality flags (for review — not fixed here)

1. **~59% of rows lack salary/placement/score data** — usable for identity + district +
   cutoff, but not for placement-based ranking.
2. **`State` has a single value ("Tamilnadu")** and 12% blank — low information; the
   canonical `state` uses "Tamil Nadu" (spelling differs — normalize before any join on state).
3. **`ocCutoff` is OC-community only** — eligibility for BC/MBC/SC/ST is **not** covered
   by this column; branch-level cutoffs remain absent.
4. **Composite scores (`PowerScore`, `IdleOutputIndex`, `careerOutcome`) are opaque** —
   their formula/definition should be documented before using them in ranking.
5. **`(Autonomous)` suffixes** in `collegeName` reduce name-match quality and inflate
   apparent name uniqueness; consider a suffix-stripping normalization for matching.
6. **194 unmatched colleges** exist in 2026 but not the warehouse — a coverage gap to
   resolve (add them, or backfill NIRF codes) in a later phase.
