# New Parameters — Formula Reference

How every newly added college parameter is calculated, the database tables/columns each one reads, and the exact thresholds used.

- **Source of truth:** [`lib/parameters.ts`](../lib/parameters.ts) (computation) and [`lib/parameters-catalog.ts`](../lib/parameters-catalog.ts) (display formatting).
- **Served by:** `GET /api/college-parameters?nirf_id=...&counselling_code=...` (cached 1 hour).
- **Keys:** Faculty / Financial / Research / Student Composition / Infrastructure are keyed by **`nirf_id`** (NIRF tables). Admissions is keyed by **`counselling_code`** (TNEA tables). Cross-Schema needs **both**.
- A value is shown as `-` whenever the underlying data is missing/null.

## Shared helper functions

| Helper | Definition |
|---|---|
| `avg(nums)` | Mean of the non-null, non-NaN values. Returns `null` if none are valid. |
| `stdDev(nums)` | Population standard deviation `√(Σ(xᵢ − mean)² / N)`. Needs ≥ 2 values, else `null`. |
| `pctChange(current, previous)` | `((current − previous) / previous) × 100`. Returns `null` if either is missing/zero. |
| `trendDirection(values)` | Fits a simple linear regression over the ordered values; uses the slope: `> 0.5 → rising`, `< −0.5 → falling`, else `flat`. Needs ≥ 2 points. |

---

## C — Faculty Quality
Source table: `nirf_faculty` (one row per faculty member), plus `nirf_financial_operational` (salaries) and `nirf_institutions` (PhD-pursuing). `total` = number of faculty rows.

| Parameter | Formula | Notes |
|---|---|---|
| **PhD Faculty %** (`phd_pct`) | `(faculty whose qualification contains "ph.d") / total × 100` | Case-insensitive substring match on `qualification`. |
| **Female Faculty %** (`female_faculty_pct`) | `(faculty with gender = "Female") / total × 100` | |
| **Avg Faculty Experience** (`avg_experience_years`) | `avg(experience_months of currently-working faculty) / 12` | Only `currently_working = "Yes"`. Rounded to 1 decimal. |
| Experience distribution (`experience_distribution`) | Among active faculty: `senior = >20 yrs`, `mid = 10–20 yrs`, `junior = <10 yrs`; each as `% of active`. | `yrs = experience_months / 12`. |
| **Faculty Retention %** (`retention_rate_pct`) | `(faculty with currently_working = "Yes") / total × 100` | `retention_flag = true` when `< 85%`. |
| Seniority mix (`seniority_mix`) | `professor / total`, `associate / total`, `assistant / total` (×100). | Professor = "Professor"; Associate = "Associate Professor"; Assistant = "Assistant Professor" or "Lecturer". |
| **Salary per Faculty** (`salary_per_faculty`) | `latest-year salaries / total` | `salaries` from the most recent `nirf_financial_operational` row. ₹/year, rounded. |
| **Faculty Pursuing PhD %** (`phd_pursuing_pct`) | `(phd_fulltime_pursuing + phd_parttime_pursuing) / total × 100` | From `nirf_institutions`. |
| **Total Faculty** (`total_faculty`) | Count of `nirf_faculty` rows for the college. | |

---

## B — Admissions Demand (TNEA)
Source tables: `tnea_allotments`, `tnea_ranks`, `tnea_cutoffs` (all by `counselling_code`), and `nirf_sanctioned_intake` for intake. Allotment rows are aggregated per year across all branches.

| Parameter | Formula | Notes |
|---|---|---|
| **Fill Rate (5yr avg) %** (`fill_rate_5yr_avg`) | Per year: `fill_rate = Σ allotted / Σ available`. Then `avg(yearly fill_rates) × 100`. | Rounded to 1 decimal. |
| Fill rate trend (`fill_rate_trend`) | `trendDirection(yearly fill_rates)` → rising / flat / falling. | |
| Intake expanded (`intake_expanded`) | `true` if available seats grew **> 20%** year-over-year in any year. | |
| **Current Intake** (`intake_current`) | `sanctioned_intake` of the most recent UG academic year. | From `nirf_sanctioned_intake`, `program_level = UG`. |
| `intake_oldest` | `sanctioned_intake` of the earliest UG academic year. | |
| **Intake Growth %** (`intake_growth_pct`) | `pctChange(intake_current, intake_oldest)` | Oldest → current. |
| Closing ranks (`closing_ranks`) | Per branch, per category (OC/BC/BCM/MBC/SC/SCA/ST): `avg_3yr = avg(last 3 years' closing rank)`. | From `tnea_ranks`. |
| Cutoff volatility (`cutoff_volatility`) | Per branch (OC reference): `max_swing = max |yearₙ − yearₙ₋₁|`, `std_dev = stdDev(OC cutoffs)`. `is_volatile = max_swing > 5 OR std_dev > 3`. | From `tnea_cutoffs`. Needs ≥ 2 years. |

---

## D — Financial Investment
Source tables: `nirf_financial_capital` (lab/equipment), `nirf_financial_operational` (salaries, maintenance, seminars), `nirf_student_strength` (UG total). Compares **2023-24 (latest)** vs **2022-23 (previous)**. `ugTotal` = UG total students.

| Parameter | Formula | Notes |
|---|---|---|
| **Spend per Student** (`spend_per_student`) | `(salaries + maintenance_infrastructure)ₗₐₜₑₛₜ / ugTotal` | ₹/year, rounded. |
| **Lab Spend per Student** (`lab_spend_per_student`) | `lab_equipment_software (2023-24) / ugTotal` | ₹/year, rounded. |
| **Lab Investment Trend %** (`lab_investment_trend_pct`) | `pctChange(lab_2023-24, lab_2022-23)` | Direction: `> 10 → up`, `< −10 → down`, else `flat`. |
| **Salary Growth %** (`salary_growth_pct`) | `pctChange(salaries_2023-24, salaries_2022-23)` | |
| **Maintenance Growth %** (`maintenance_growth_pct`) | `pctChange(maintenance_2023-24, maintenance_2022-23)` | |
| **Seminar Spend per Student** (`seminar_spend_per_student`) | `seminars_workshops (2023-24) / ugTotal` | ₹/year, rounded. |

---

## E — Research & Innovation
Source tables: `nirf_ipr` (patents), `nirf_sponsored_research`, `nirf_consultancy`, `nirf_phd_graduated`. `totalFaculty` comes from the Faculty section.

| Parameter | Formula | Notes |
|---|---|---|
| **Patents per 100 Faculty** (`patents_per_100_faculty`) | `(patents_published_latest / totalFaculty) × 100` | Latest calendar year from `nirf_ipr`. |
| **Sponsored Research / Faculty** (`sponsored_research_per_faculty`) | `total_amount_received (latest) / totalFaculty` | ₹, rounded. |
| **Consultancy Revenue** (`consultancy_revenue`) | `total_amount_received` of the latest financial year. | `consultancy_trend_pct = pctChange(latest, previous)`. |
| **PhD Output / Year** (`phd_output_avg_per_year`) | `avg( fulltime_graduated + parttime_graduated )` over 2023-24 & 2022-23. | |
| **Research Score (0–100)** (`research_score`) | Sum of 4 components, each capped at 25 (only computed if **all four** are available): | |
| &nbsp;&nbsp;• Patents component | `min(25, (patents_per_100_faculty / 50) × 25)` | 50 patents/100 faculty = full 25. |
| &nbsp;&nbsp;• Sponsored component | `min(25, (sponsored_research_per_faculty / 100000) × 25)` | ₹1 lakh/faculty = full 25. |
| &nbsp;&nbsp;• Consultancy component | `min(25, (consultancy_revenue / 50000000) × 25)` | ₹5 crore = full 25. |
| &nbsp;&nbsp;• PhD component | `min(25, (phd_output_avg_per_year / 50) × 25)` | 50 PhDs/year = full 25. |

---

## F — Student Composition
Source table: `nirf_student_strength`. Uses the UG row (`program_level` containing `UG [4` or starting with `UG`) and the PG row similarly. `ugTotal` = UG total students.

| Parameter | Formula | Notes |
|---|---|---|
| **Reserved Category %** (`reserved_category_pct`) | `socially_challenged / ugTotal × 100` | SC/ST/OBC bucket. |
| **Economically Backward %** (`economically_backward_pct`) | `economically_backward / ugTotal × 100` | |
| **Open Category %** (`open_category_pct`) | `full_fee_reimbursement / ugTotal × 100` | Field name is `full_fee_reimbursement` (no-reservation / full-fee students). |
| **PG:UG Ratio** (`pg_to_ug_ratio`) | `pgTotal / ugTotal` | Rounded to 3 decimals. |

---

## G — Infrastructure & Accreditation
Source tables: `nirf_accreditation` (NAAC), `nirf_sdg_qualitative` (green), `nirf_institutions` (accessibility), `nirf_executive_dev_programs` (EDP).

| Parameter | Formula | Notes |
|---|---|---|
| **NAAC Score** (`naac_score`) | `parseFloat(grade_or_score)` of the latest NAAC accreditation row. | |
| **NAAC Status** (`naac_status`) | From `valid_to`: `expiry_days < 0 → lapsed`, `< 365 → expiring`, else `valid`; no row → `not_accredited`. | `expiry_days = (valid_to − today) in days`. |
| **Green Campus Score (0–6)** (`green_campus_score`) | Count of these 6 fields that are non-empty in `nirf_sdg_qualitative`: renewable energy, rainwater harvesting, recycling, food-waste approach, single-use-plastic measures, carbon-footprint actions. | Tier: `6 → Green Campus`, `≥3 → Eco Aware`, else `Not Reported`. |
| **Accessibility Score (0–3)** (`accessibility_score`) | Count of `pcs_lifts_ramps`, `pcs_walking_aids`, `pcs_toilets` that contain "yes". | From `nirf_institutions`. |
| **EDP Programs** (`edp_programs_count`) | `total_programs` for FY 2023-24. | From `nirf_executive_dev_programs`. |
| **EDP Participants/Program** (`edp_participants_per_program`) | `total_participants / total_programs` | Rounded to 1 decimal. |

---

## H — Cross-Schema Indices
Needs **both** `nirf_id` and `counselling_code`. Combines `nirf_placement_higher_studies` (placement) with `tnea_allotments` (seats) and the Admissions section's fill rate.

| Parameter | Formula | Notes |
|---|---|---|
| **Placement Yield %** (`placement_yield_pct`) | `students_placed (latest) / (Σ allotted over last 5 yrs / 5) × 100` | Placed in latest cohort vs the average yearly allotment. |
| **Demand-Quality Index** (`demand_quality_index`) | `avg(fill_rate_5yr_avg, placement_pct_latest)` | `placement_pct = students_placed / (first_year_admitted + lateral_entry_count) × 100`. |
| **Intake-Outcome Efficiency** (`intake_outcome_efficiency`) | `(placement_pctₙₑw / placement_pctₒₗd) / (cohortₙₑw / cohortₒₗd)` | Uses newest vs oldest of the last 3 placement years. `cohort = first_year_admitted + lateral_entry_count`. > 1 = outcomes improving faster than intake grew. |
| Salary-to-Cost Ratio (`salary_cost_ratio`) | **Not implemented** — always `null` (Phase 2, needs fee data). | |

---

## Display formatting
Applied in [`lib/parameters-catalog.ts`](../lib/parameters-catalog.ts) `formatNewParamValue()`:

| Format | Output |
|---|---|
| `percent` | `12.3%` |
| `currency` | `₹1,46,206` (Indian grouping, rounded) |
| `ratio` | 2 decimals |
| `number` | Integer with Indian grouping, else raw |
| `text` | As-is |
| missing/null | `-` |

> **Note on data coverage:** these metrics only resolve for colleges that have an NIRF link (`nirf_id`) and/or TNEA data (`counselling_code`). The NIRF parameter tables currently hold data for ~209 institutions; colleges without NIRF data show `-` for all NIRF-based rows (Admissions/Fill Rate still shows from TNEA).
