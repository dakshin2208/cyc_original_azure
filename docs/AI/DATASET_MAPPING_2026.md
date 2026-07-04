# Dataset Mapping — `2026_final_NIRF_data.csv`

**Scope:** integrate the 2026 canonical NIRF dataset into the warehouse as an
**additive** enrichment source. This document maps every column. **No
recommendation/ranking/eligibility/prompt logic is changed** — the "participates
in" column below is a *proposal* for future work, not a wired behaviour.

- **Rows:** 492 · **Columns:** 19 · **Source dir:** `CYC_DATA_DIR/2026_final_NIRF_data.csv`
- **Warehouse it merges into:** 324 canonical colleges (`CanonicalCollege`).
- **Merge key cascade:** `NIRF Code` → `CollegeCode` → normalized name (see [MERGE_REPORT_2026.md](./MERGE_REPORT_2026.md)).

## Column map

Legend for "Participates in (PROPOSED)": R=retrieval, K=ranking, E=eligibility,
C=confidence, Q=citations. **All proposed — nothing is wired yet.**

| # | Column | Meaning | Existing warehouse field | New? | Type | Fill | Participates in (PROPOSED) |
|---|--------|---------|--------------------------|------|------|------|----------------------------|
| 1 | `NIRF Code` | NIRF institution id (`IR-E-C-…`) | `CanonicalCollege.nirfId` | maps (join key) | string | 41.9% | — (identity/join) · Q |
| 2 | `CollegeCode` | TNEA counselling code | `CanonicalCollege.counsellingCodes` (today **empty**) | maps (join key, currently unpopulated) | string/int | 94.9% | R, E (by code) |
| 3 | `instituteName` | Short institute name | `CanonicalCollege.name` (alias) | maps | string | 41.9% | R, Q |
| 4 | `collegeName` | Full college name (`… (Autonomous)`) | `CanonicalCollege.name` | maps | string | 100% | R, Q |
| 5 | `avgMedianSalary` | Avg median placement salary (₹) | ~`CanonicalPlacement.medianSalary` (alt source) | enriches | number (₹) | 41.1% | K (placement), C, Q |
| 6 | `avgPlacementPercentage` | Avg placement rate (%) | ~placement rate | enriches | number (%) | 41.1% | K (placement), C, Q |
| 7 | `avgPassingPercentage` | Avg pass/graduation rate (%) | — | **NEW** | number (%) | 41.1% | K (academic), C, Q |
| 8 | `avgHigherStudiesPercentage` | % going to higher studies | — (source exists, not on college) | **NEW** | number (%) | 41.1% | K, C, Q |
| 9 | `IdleOutputIndex` | Composite "idle output" metric (opaque) | — | **NEW** | number | 41.1% | K? (needs definition) |
| 10 | `avgScholarshipPercentage` | % students on scholarship | — | **NEW** | number (%) | 41.9% | K (affordability), Q |
| 11 | `totalIntake` | Total sanctioned intake (seats) | — (not in warehouse) | **NEW** | number (count) | 41.7% | R, E (context), Q |
| 12 | `avgSeatsFilled` | Avg seats filled (%) | — | **NEW** | number (%) | 40.9% | K (demand), E (signal), Q |
| 13 | `avgWomenStudents` | Avg women students (%) | — | **NEW** | number (%) | 41.9% | R, Q |
| 14 | `avgOutsideStudents` | Avg out-of-state students (%) | — | **NEW** | number (%) | 41.9% | Q |
| 15 | `ocCutoff` | **OC-community closing cutoff** (TNEA marks, 0–200) | — (cutoffs are branch/community in `Ftnea_cutoffs.csv`) | **NEW** (college-level OC cutoff) | number | 74.4% | **E (primary!)**, R, C, Q |
| 16 | `State` | State | `CanonicalCollege.state` | maps | string | 87.6% | R (filter) |
| 17 | `District` | **District** | — (`CanonicalCollege` has `city`, not `district`) | **NEW** | string | 87.6% | **R (district filter!)**, Q |
| 18 | `PowerScore` | Composite quality/power score (0–100) | — | **NEW** | number | 40.9% | K (composite), C |
| 19 | `careerOutcome` | Composite career-outcome score (0–100) | — | **NEW** | number | 41.1% | K, C |

## Where this data maps in the current schema

- **Identity / join:** `NIRF Code` ↔ `CanonicalCollege.nirfId` (the only structurally
  reliable bridge — 206/492 rows carry it and every existing college has a `nirfId`).
- **`CollegeCode` ↔ `counsellingCodes`:** the field exists on `CanonicalCollege` but
  is **empty for all 324 colleges today** (the TNEA↔NIRF bridge was never populated),
  so CollegeCode currently matches **nothing** on the existing side. It is still
  parsed and retained (it is the best-covered id in the *new* data at 94.9%) and is
  the natural key once counselling codes are backfilled.
- **Placement/salary (`avgMedianSalary`, `avgPlacementPercentage`)** overlap the
  existing `placement_higher_studies.csv`-derived `CanonicalPlacement` facts — the
  2026 values are kept **separately** on the profile (they do not overwrite the
  existing placement facts).
- **Genuinely new dimensions:** `ocCutoff` (college-level OC closing cutoff → the
  eligibility signal the audit flagged as missing, RC4), `District` (→ the district
  filter the audit flagged as missing, RC2), and the composite scores
  (`PowerScore`, `careerOutcome`, `IdleOutputIndex`) + demographic/intake fields.

## How it is stored (additive)

Each row becomes a `Nirf2026Profile`; matched profiles are indexed by canonical
college id on `warehouse.nirf2026.byCollege`. The existing `CanonicalCollege`,
`CanonicalPlacement`, etc. are **not mutated** and the recommendation input set is
unchanged. See [`lib/knowledge/nirf2026/`](../../lib/knowledge/nirf2026/).
