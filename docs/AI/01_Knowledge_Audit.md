# AI College Counselor — Knowledge Audit (01)

**Project:** ChooseYourCollege (CYC)
**Document type:** Architect-level Knowledge Audit — *what knowledge exists, what it means, and how usable it is for an AI College Counselor.*
**Scope:** Inventory and interpretation of every dataset. **No chatbot, embedding, or RAG design here** — this document only establishes the knowledge foundation those will later stand on.
**Method:** Every dataset was inspected directly, not assumed — via the CSV loader (`scripts/load-csvs.mjs`, authoritative column definitions), the parameter engine (`lib/parameters.ts`), the parameter catalog (`lib/parameters-catalog.ts`), the formula reference (`docs/new-parameters-formulas.md`), the service layer (`lib/college-service.ts`, `lib/college-data.ts`), and live schema/count queries against the production database.

---

## 0. Executive Orientation

CYC's knowledge is organized in **four layers**, which is the single most important thing to understand before building any AI on top of it:

| Layer | Purpose | Identifier | Access | Populated? |
|---|---|---|---|---|
| **L1 — Product tables** (`colleges`, `Cutoff`, `Rank`) | Denormalized, pre-computed data that powers today's live search/prediction UI | `College Code` (+ carries `NIRF Code`) | Public (anon-readable) | Yes — 492 / 3,457 / 3,457 rows |
| **L2 — TNEA warehouse** (`tnea_*`) | Normalized, multi-year admissions history | `counselling_code` + `branch` + `year` | RLS-protected | Yes (confirmed via API) |
| **L3 — NIRF warehouse** (`nirf_*`) | Normalized institutional quality/outcome data | `nirf_id` | RLS-protected | Yes (confirmed via API) |
| **L4 — Derived intelligence** (`/api/college-parameters`) | ~34 computed parameters across 7 dimensions | joins `nirf_id` + `counselling_code` | Computed on demand (not stored) | Live |

**The central integration fact:** two independent identifier systems coexist — `nirf_id` (an *institution*, e.g. `IR-E-C-16614`) and `counselling_code` (a TNEA *admission unit*, e.g. `1101`). NIRF knowledge is **institution-grained**; TNEA knowledge is **branch-grained**. The only place they are bridged is inside the L1 tables, which carry *both* `College Code` and `NIRF Code` on each row. **Any college without a NIRF linkage has only admissions knowledge and no quality/outcome knowledge.** This partial-coverage boundary is the defining constraint for the counselor.

> Row counts: L1 counts are directly measured. L2/L3 tables are RLS-protected from the anon role, so exact counts are not stated here rather than guessed; their population is *confirmed* because `/api/college-parameters` returns real computed values sourced from them.

---

## 1. Per-Dataset Audit

Legend for the 10 required attributes is applied to every dataset below: **(1)** Name · **(2)** Business purpose · **(3)** Main entities · **(4)** Important columns · **(5)** Primary identifier · **(6)** Relationships · **(7)** Information contained · **(8)** Information missing · **(9)** Business value · **(10)** AI usefulness.

---

### L1 — PRODUCT TABLES (live, public)

#### 1.1 `colleges`
1. **Name:** `colleges`
2. **Business purpose:** One-row-per-college denormalized summary that backs the college listing/compare experience and the headline "scores."
3. **Main entities:** College (institution as presented to a student).
4. **Important columns:** `CollegeCode`, `collegeName`, `instituteName`, `NIRF Code`, `State`, `District`, `ocCutoff`, `avgMedianSalary`, `avgPlacementPercentage`, `avgPassingPercentage`, `avgHigherStudiesPercentage`, `avgScholarshipPercentage`, `totalIntake`, `avgSeatsFilled`, `avgWomenStudents`, `avgOutsideStudents`, `IdleOutputIndex`, `PowerScore`, `careerOutcome` (20 columns).
5. **Primary identifier:** `CollegeCode` (TNEA counselling code); `NIRF Code` present as the bridge to L3.
6. **Relationships:** 1→N to `Cutoff`/`Rank` on `College Code`; N→1 to L3 `nirf_*` via `NIRF Code`.
7. **Information contained:** Location, headline cutoff, pre-aggregated outcome averages, and precomputed indices (`PowerScore`, `IdleOutputIndex`, `careerOutcome`) sourced from the ingestion pipeline (not recomputed in app code).
8. **Information missing:** No per-branch detail, no time series (single denormalized snapshot), no provenance/vintage for the averages, no fee data. Index definitions (`PowerScore`) are opaque — not derived in code.
9. **Business value:** High — this is the "shelf" a student browses; the scores are the product's differentiation.
10. **AI usefulness:** High for fast retrieval, ranking, and summary "college cards." Low for *reasoning* (opaque scores, no branch granularity, no explainability of `PowerScore`).

#### 1.2 `Cutoff`
1. **Name:** `Cutoff`
2. **Business purpose:** Branch×college closing **marks** by reservation community — the core input to the "will I get in?" predictor.
3. **Main entities:** College-Branch admission unit.
4. **Important columns:** `College Code`, `College Name`, `Branch Code`, `Branch Name`, `NIRF Code`, `State`, `District`, community marks `OC, BC, BCM, MBC, MBCDNC, MBCV, SC, SCA, ST`, plus denormalized outcomes (`avgMedianSalary`, `avgPlacementPercentage`, `totalIntake`, `avgSeatsFilled`, `PowerScore`, …) — 30 columns.
5. **Primary identifier:** Composite (`College Code` + `Branch Code`); surrogate `id`.
6. **Relationships:** N→1 to `colleges` (`College Code`); bridges to L3 via `NIRF Code`; conceptually overlaps L2 `tnea_cutoffs`.
7. **Information contained:** Closing cutoff marks per community for each branch, with denormalized college outcomes attached.
8. **Information missing:** **No year column** (single snapshot — no volatility/trend), community marks **stored as text** (breaks numeric comparison/sorting), no seat *counts* per community (only cutoff marks).
9. **Business value:** Very high — the predictor is the app's flagship feature.
10. **AI usefulness:** Very high as ground truth for eligibility/prediction — **but only after the text-typed numeric columns are fixed**; otherwise the AI inherits the same numeric-comparison defect.

#### 1.3 `Rank`
1. **Name:** `Rank`
2. **Business purpose:** Same as `Cutoff` but stores closing **ranks** by community (for rank-based prediction mode).
3. **Main entities:** College-Branch admission unit.
4. **Important columns:** Identical shape to `Cutoff` (30 columns) with `OC…ST` holding rank values; includes `avgNON-Graduated`, `PowerScore`.
5. **Primary identifier:** Composite (`College Code` + `Branch Code`); surrogate `id`.
6. **Relationships:** Parallel to `Cutoff`; N→1 to `colleges`; bridge via `NIRF Code`.
7. **Information contained:** Closing rank per community per branch.
8. **Information missing:** Same as `Cutoff` — no year, numeric-as-text (the app already compensates by filtering ranks in memory).
9. **Business value:** High — rank mode of the predictor.
10. **AI usefulness:** High; cleaner to consume than `Cutoff` only because the app already treats ranks as strings and filters in JS. Same normalization need.

---

### L2 — TNEA ADMISSIONS WAREHOUSE (normalized, multi-year)

#### 1.4 `tnea_cutoffs`
1. **Name:** `tnea_cutoffs`
2. **Business purpose:** Historical, multi-year closing marks per branch/community — the *time-aware* basis for demand and volatility analysis.
3. **Main entities:** (Counselling unit × branch × year).
4. **Important columns:** `counselling_code`, `branch`, `year`, `oc, bc, bcm, mbc, sc, sca, st` (numeric floats).
5. **Primary identifier:** Composite (`counselling_code`, `branch`, `year`).
6. **Relationships:** Keyed to L1 via `counselling_code = College Code`; consumed by the admissions parameters.
7. **Information contained:** Year-on-year cutoff marks by community.
8. **Information missing:** Fewer community columns than L1 `Cutoff` (no `MBCDNC`/`MBCV`); coverage depth per year not guaranteed.
9. **Business value:** High — enables "cutoff is rising/falling" narratives.
10. **AI usefulness:** High and **correctly typed (numeric)** — preferable to L1 `Cutoff` for reasoning about trends; ideal for "is this branch getting more competitive?"

#### 1.5 `tnea_ranks`
1. **Name:** `tnea_ranks`
2. **Business purpose:** Multi-year closing **ranks** per branch/community.
3. **Main entities:** (Counselling unit × branch × year).
4. **Important columns:** `counselling_code`, `branch`, `year`, `oc…st` (integers).
5. **Primary identifier:** Composite (`counselling_code`, `branch`, `year`).
6. **Relationships:** Parallels `tnea_cutoffs`; joins L1 via `counselling_code`.
7. **Information contained:** Historical rank cutoffs.
8. **Information missing:** Same community-column gap; per-year completeness varies.
9. **Business value:** High for rank-based prediction and trend explanations.
10. **AI usefulness:** High, numeric, trend-ready.

#### 1.6 `tnea_allotments`
1. **Name:** `tnea_allotments`
2. **Business purpose:** Seat supply vs. take-up per branch/year — the **demand signal**.
3. **Main entities:** (Counselling unit × branch × year).
4. **Important columns:** `counselling_code`, `branch`, `year`, `allotted`, `available`, `fill_rate`.
5. **Primary identifier:** Composite (`counselling_code`, `branch`, `year`).
6. **Relationships:** Joins L1 via `counselling_code`; combined with placement in the **cross-schema** indices (`placement_yield_pct`).
7. **Information contained:** Allotted seats, available seats, fill rate per year.
8. **Information missing:** No breakdown by community/category; no waitlist/round-wise movement.
9. **Business value:** High — "how hard is this seat to get / how popular is it."
10. **AI usefulness:** High — the best available proxy for real demand; central to safety/target/reach classification.

---

### L3 — NIRF INSTITUTIONAL WAREHOUSE (normalized, institution-grained)

#### 1.7 `nirf_institutions` *(parent/master)*
1. **Name:** `nirf_institutions`
2. **Business purpose:** Master record for each NIRF-reporting institution; anchor for all other `nirf_*` tables.
3. **Main entities:** Institution.
4. **Important columns:** `nirf_id`, `institution_name`, `nirf_category`, `submission_year`, `pincode`, `pcs_lifts_ramps`, `pcs_walking_aids`, `pcs_toilets`, `phd_fulltime_pursuing`, `phd_parttime_pursuing`, `source_file`.
5. **Primary identifier:** `nirf_id`.
6. **Relationships:** 1→N parent to every other `nirf_*` table; linked to L1 via `NIRF Code`.
7. **Information contained:** Institutional identity, category, location (pincode), disability-accessibility facilities, PhD-in-progress counts.
8. **Information missing:** No geocoordinates (only pincode), no ranking/tier, single `submission_year` (thin history).
9. **Business value:** Medium as data; **critical as the join spine**.
10. **AI usefulness:** High structurally (the key that unlocks all quality knowledge); `pcs_*` supports accessibility-aware advice.

#### 1.8 `nirf_faculty`
1. **Name:** `nirf_faculty`
2. **Business purpose:** Person-level faculty roster underpinning all faculty-quality metrics.
3. **Main entities:** Faculty member.
4. **Important columns:** `nirf_id`, `sr_no`, `name`, `age`, `designation`, `gender`, `qualification`, `experience_months`, `currently_working`, `joining_date`, `leaving_date`, `association_type`.
5. **Primary identifier:** Composite (`nirf_id`, `sr_no`).
6. **Relationships:** N→1 to `nirf_institutions`; drives `phd_pct`, `female_faculty_pct`, `avg_experience_years`, `retention_rate_pct`, `total_faculty`.
7. **Information contained:** Qualifications (PhD detection), demographics, tenure, retention status.
8. **Information missing:** No department/branch attribution (cannot compute *per-branch* faculty quality), no research output per person, no pay band.
9. **Business value:** High — faculty quality is a top comparison axis.
10. **AI usefulness:** High for institution-level "teaching quality" narratives; **cannot** answer "faculty for *my* branch" (granularity gap).

#### 1.9 `nirf_student_strength`
1. **Name:** `nirf_student_strength`
2. **Business purpose:** Enrollment composition by program level.
3. **Main entities:** (Institution × program level).
4. **Important columns:** `nirf_id`, `program_level`, `male_students`, `female_students`, `total_students`, `within_state`, `outside_state`, `outside_country`, `economically_backward`, `socially_challenged`, `full_fee_reimbursement`.
5. **Primary identifier:** Composite (`nirf_id`, `program_level`).
6. **Relationships:** N→1 to institution; feeds **Student Composition** params + `pg_to_ug_ratio`.
7. **Information contained:** Gender mix, geographic diversity, socio-economic composition, PG:UG balance.
8. **Information missing:** No branch-level composition; no year series.
9. **Business value:** Medium–High — diversity/inclusion and "peer profile."
10. **AI usefulness:** High for "what kind of student body," inclusion-aware and outstation-friendliness advice.

#### 1.10 `nirf_sanctioned_intake`
1. **Name:** `nirf_sanctioned_intake`
2. **Business purpose:** Sanctioned seats by program/year — supply and growth.
3. **Main entities:** (Institution × program level × academic year).
4. **Important columns:** `nirf_id`, `program_level`, `program_duration`, `academic_year`, `sanctioned_intake`.
5. **Primary identifier:** Composite (`nirf_id`, `program_level`, `academic_year`).
6. **Relationships:** Feeds `intake_current`, `intake_growth_pct`, and `intake_outcome_efficiency`.
7. **Information contained:** Seat sanction levels and multi-year growth.
8. **Information missing:** Institution-level only (not per-branch); no category split.
9. **Business value:** Medium — capacity/growth signal.
10. **AI usefulness:** Medium; supports "is this program expanding" context.

#### 1.11 `nirf_placement_higher_studies`
1. **Name:** `nirf_placement_higher_studies`
2. **Business purpose:** Placement, salary, and higher-studies outcomes by cohort — the outcome backbone.
3. **Main entities:** (Institution × program level × graduating cohort).
4. **Important columns:** `nirf_id`, `program_level`, `graduating_year`, `first_year_intake`, `first_year_admitted`, `students_placed`, `median_salary`, `students_higher_studies`, lateral-entry fields.
5. **Primary identifier:** Composite (`nirf_id`, `program_level`, `graduating_year`).
6. **Relationships:** N→1 to institution; combined with `tnea_allotments` in **cross-schema** `placement_yield_pct` / `demand_quality_index`.
7. **Information contained:** Median salary, placement counts, higher-studies counts, cohort sizes.
8. **Information missing:** No recruiter names, no salary distribution (only median), no branch-level placement, no CTC vs. base.
9. **Business value:** Very high — outcomes drive college choice.
10. **AI usefulness:** Very high for ROI/outcome narratives; limited for "which companies" (not present).

#### 1.12 `nirf_financial_capital`
1. **Name:** `nirf_financial_capital`
2. **Business purpose:** Capital expenditure — infrastructure investment.
3. **Main entities:** (Institution × academic year).
4. **Important columns:** `nirf_id`, `academic_year`, `library`, `lab_equipment_software`, `engineering_workshops`, `studios`, `other_capital_assets`.
5. **Primary identifier:** Composite (`nirf_id`, `academic_year`).
6. **Relationships:** Feeds `lab_spend_per_student`, `lab_investment_trend_pct` (per-student via `nirf_student_strength`).
7. **Information contained:** Spend on library, labs, workshops, studios.
8. **Information missing:** Only two comparable years used (`2023-24`, `2022-23`) → shallow trend; no absolute infra inventory (e.g., #labs).
9. **Business value:** Medium — "is the college investing in facilities."
10. **AI usefulness:** Medium; good supporting evidence, weak standalone.

#### 1.13 `nirf_financial_operational`
1. **Name:** `nirf_financial_operational`
2. **Business purpose:** Operational expenditure — running investment per student.
3. **Main entities:** (Institution × academic year).
4. **Important columns:** `nirf_id`, `academic_year`, `salaries`, `maintenance_infrastructure`, `seminars_workshops`.
5. **Primary identifier:** Composite (`nirf_id`, `academic_year`).
6. **Relationships:** Feeds `spend_per_student`, `salary_per_faculty`, `salary_growth_pct`, `maintenance_growth_pct`, `seminar_spend_per_student`.
7. **Information contained:** Salary, maintenance, seminar spend.
8. **Information missing:** Two-year window only; no scholarship spend line; not student-facing *fees*.
9. **Business value:** Medium.
10. **AI usefulness:** Medium; per-student spend is a credible quality proxy.

#### 1.14 `nirf_ipr`
1. **Name:** `nirf_ipr`
2. **Business purpose:** Patent activity (innovation).
3. **Main entities:** (Institution × calendar year).
4. **Important columns:** `nirf_id`, `calendar_year`, `patents_published`, `patents_granted`.
5. **Primary identifier:** Composite (`nirf_id`, `calendar_year`).
6. **Relationships:** Feeds `patents_per_100_faculty` and `research_score`.
7. **Information contained:** Patents published/granted per year.
8. **Information missing:** No patent domains/quality, no commercialization.
9. **Business value:** Low–Medium (matters for research-oriented students).
10. **AI usefulness:** Medium; niche but differentiating for research-minded applicants.

#### 1.15 `nirf_sponsored_research`
1. **Name:** `nirf_sponsored_research`
2. **Business purpose:** External research funding.
3. **Main entities:** (Institution × financial year).
4. **Important columns:** `nirf_id`, `financial_year`, `total_projects`, `total_funding_agencies`, `total_amount_received`.
5. **Primary identifier:** Composite (`nirf_id`, `financial_year`).
6. **Relationships:** Feeds `sponsored_research_per_faculty`, `research_score`.
7. **Information contained:** Project counts, agencies, funding amount.
8. **Information missing:** No per-department split, no PI-level detail.
9. **Business value:** Low–Medium.
10. **AI usefulness:** Medium for research-intensity narratives.

#### 1.16 `nirf_consultancy`
1. **Name:** `nirf_consultancy`
2. **Business purpose:** Industry consultancy engagement (applied strength).
3. **Main entities:** (Institution × financial year).
4. **Important columns:** `nirf_id`, `financial_year`, `total_projects`, `total_client_organizations`, `total_amount_received`.
5. **Primary identifier:** Composite (`nirf_id`, `financial_year`).
6. **Relationships:** Feeds `consultancy_revenue`, `research_score`.
7. **Information contained:** Consultancy projects, clients, revenue.
8. **Information missing:** No sector/industry tags.
9. **Business value:** Low–Medium.
10. **AI usefulness:** Medium; signals industry connectivity.

#### 1.17 `nirf_phd_graduated`
1. **Name:** `nirf_phd_graduated`
2. **Business purpose:** Doctoral output (research maturity).
3. **Main entities:** (Institution × academic year).
4. **Important columns:** `nirf_id`, `academic_year`, `fulltime_graduated`, `parttime_graduated`.
5. **Primary identifier:** Composite (`nirf_id`, `academic_year`).
6. **Relationships:** Feeds `phd_output_avg_per_year`, `research_score`.
7. **Information contained:** PhDs graduated per year.
8. **Information missing:** No discipline split.
9. **Business value:** Low–Medium.
10. **AI usefulness:** Medium; mostly relevant to PG/research seekers.

#### 1.18 `nirf_accreditation`
1. **Name:** `nirf_accreditation`
2. **Business purpose:** Accreditation status/quality stamp (NAAC/NBA).
3. **Main entities:** (Institution × accreditation body × validity period).
4. **Important columns:** `nirf_id`, `body`, `valid_from`, `valid_to`, `grade_or_score`.
5. **Primary identifier:** Composite (`nirf_id`, `body`, `valid_from`).
6. **Relationships:** Feeds `naac_score`, `naac_status` (currently filtered to `body = 'NAAC'`).
7. **Information contained:** Accrediting body, grade/score, validity window.
8. **Information missing:** NBA/branch-level program accreditation not surfaced (only NAAC consumed); no autonomy status.
9. **Business value:** High — accreditation is a trust signal parents care about.
10. **AI usefulness:** High and easy to explain ("NAAC A+, valid to 2027"); expand beyond NAAC.

#### 1.19 `nirf_sdg_qualitative`
1. **Name:** `nirf_sdg_qualitative`
2. **Business purpose:** Sustainability/green-campus practices (qualitative).
3. **Main entities:** Institution.
4. **Important columns:** `nirf_id`, `single_use_plastic_measures`, `carbon_footprint_actions`, `recycling_infrastructure`, `rainwater_harvesting_types`, `renewable_energy_sources`, `food_waste_approach`, `sustainable_transport`.
5. **Primary identifier:** `nirf_id`.
6. **Relationships:** Feeds `green_campus_score` (0–6 count of practices).
7. **Information contained:** Presence of sustainability practices.
8. **Information missing:** Free-text/inconsistent categories; no quantitative outcomes here (those live in `nirf_sdg_quantitative`).
9. **Business value:** Low (niche differentiator).
10. **AI usefulness:** Low–Medium; useful only for values-driven students.

#### 1.20 `nirf_sdg_quantitative` *(defined in loader)*
1. **Name:** `nirf_sdg_quantitative`
2. **Business purpose:** Quantitative sustainability metrics.
3. **Main entities:** (Institution × year).
4. **Important columns:** `nirf_id`, `year`, `campus_area_total/green`, `energy_generated/consumed_kw`, water/rainwater metrics, `total_trees`, `aqi_max/min`, waste/biogas metrics.
5. **Primary identifier:** Composite (`nirf_id`, `year`).
6. **Relationships:** Institution child; **not currently consumed** by any surfaced parameter.
7. **Information contained:** Detailed environmental metrics.
8. **Information missing:** No consumer of this data yet (latent knowledge).
9. **Business value:** Low today.
10. **AI usefulness:** Low–Medium; latent — could power "greenest campus" style answers if activated.

#### 1.21 `nirf_executive_dev_programs`
1. **Name:** `nirf_executive_dev_programs`
2. **Business purpose:** Executive/continuing-education activity (industry engagement).
3. **Main entities:** (Institution × financial year).
4. **Important columns:** `nirf_id`, `financial_year`, `total_programs`, `total_participants`, `total_earnings`.
5. **Primary identifier:** Composite (`nirf_id`, `financial_year`).
6. **Relationships:** Feeds `edp_programs_count`, `edp_participants_per_program`.
7. **Information contained:** EDP counts, participants, earnings.
8. **Information missing:** No topic/audience detail.
9. **Business value:** Low.
10. **AI usefulness:** Low; peripheral signal.

#### 1.22 `nirf_mea_iks` *(defined in loader)*
1. **Name:** `nirf_mea_iks` (Multiple-Entry-Exit / Indian Knowledge Systems — NEP alignment)
2. **Business purpose:** NEP-2020 policy alignment flags.
3. **Main entities:** Institution.
4. **Important columns:** `nirf_id`, `multiple_entry_exit`, `courses_indian_languages`, `courses_indian_knowledge`, `grievance_redressal_cell`, `national_state_entrance_exam` (booleans).
5. **Primary identifier:** `nirf_id`.
6. **Relationships:** Institution child; **not currently surfaced** in parameters.
7. **Information contained:** Boolean NEP-alignment indicators.
8. **Information missing:** No consumer; boolean-only (no depth).
9. **Business value:** Low.
10. **AI usefulness:** Low; latent policy-alignment context.

---

### L4 — DERIVED INTELLIGENCE (computed, not stored)

#### 1.23 `college-parameters` (computed parameter set)
1. **Name:** `/api/college-parameters` → `CollegeParameters`
2. **Business purpose:** Turns raw L2/L3 data into ~34 decision-ready metrics across 7 dimensions.
3. **Main entities:** A college resolved by (`nirf_id`, `counselling_code`).
4. **Important columns (sections):** *Faculty Quality* (7), *Admissions Demand* (3), *Financial Investment* (6), *Research & Innovation* (5), *Student Composition* (4), *Infrastructure & Accreditation* (6), *Cross-Schema Indices* (3) — e.g. `phd_pct`, `fill_rate_5yr_avg`, `spend_per_student`, `research_score`, `pg_to_ug_ratio`, `naac_score`, `placement_yield_pct`, `demand_quality_index`, `intake_outcome_efficiency`.
5. **Primary identifier:** Requires both `nirf_id` (quality) and `counselling_code` (demand) for full coverage.
6. **Relationships:** The **join layer** across L2 + L3; formulas documented in `docs/new-parameters-formulas.md`.
7. **Information contained:** Normalized, per-student and per-faculty ratios, trends, and composite indices.
8. **Information missing:** Ephemeral (recomputed, 1-hour in-process cache — not queryable/joinable as data); trend params limited to shallow 2-year windows; a known linkage quirk passes `counsellingCode` into a `nirf_id` filter for one intake lookup (fragile).
9. **Business value:** Very high — this *is* the analytical product.
10. **AI usefulness:** **Highest signal-to-noise dataset for the counselor** — pre-normalized, explainable via published formulas, comparison-ready. Should be the counselor's primary reasoning surface, with raw tables as drill-down.

---

### L5 — OPERATIONAL / USER DATASETS (not college knowledge; audited for completeness & governance)

These are **not** counseling knowledge but are part of the data estate and carry governance weight.

| Dataset | Purpose | Identifier | Contains | AI relevance | Note |
|---|---|---|---|---|---|
| `profiles` (~3,017) | User accounts | `id` (auth uid) | email, full_name, phone, referral_code | Personalization only | **PII — currently anon-readable (governance risk, see §4)** |
| `choice_filling_usage` (~2,996) | Metering of the paid feature | `user_id` (unique) | usage_count, max_choices, plan | Entitlement gating | Had duplicate-key issues (`database/fix-duplicates.sql`) |
| `choice_filling_logs` | Activity/audit log | surrogate | usage events | Behavioral signal (future) | — |
| `user_choice_filling_data` | Saved user choice lists | `user_id` | student's chosen colleges/order | **High latent value** for preference learning | Underused |
| `user_referrals` (~129) | Referral/growth graph | surrogate | referrer/referred email+phone, status | Growth analytics | PII exposure risk |
| `student_params` | Legacy seed schema | `college_id` | placement/salary/etc. | None | **Empty/unused** (`database/seed.js` only) |

---

## 2. Overall Knowledge Map

```
                         ┌─────────────────────────────┐
                         │   nirf_institutions (nirf_id)│  ◄── L3 join spine
                         └──────────────┬──────────────┘
        ┌──────────┬──────────┬─────────┼─────────┬──────────┬───────────┐
     faculty   student_    financial_  ipr /     accreditation  sdg_*    edp /
              strength    capital/op  research/                          mea_iks
        │          │          │       consultancy    │            │        │
        └──────────┴──────────┴───────────┬──────────┴────────────┴────────┘
                                          │  (all N→1 on nirf_id)
                                          ▼
                        ┌───────────────────────────────────┐
        counselling_    │   L4  college-parameters (compute) │  ◄── reasoning surface
        code  ─────────►│   joins nirf_id + counselling_code │
          │             └───────────────────┬───────────────┘
          ▼                                 │
   ┌───────────────┐                        │
   │ L2 tnea_*      │  cutoffs / ranks /     │
   │ (code+branch+  │  allotments (by year)  │
   │  year)         │────────────────────────┘
   └──────┬─────────┘
          │  counselling_code = College Code   (THE BRIDGE)
          ▼
   ┌──────────────────────────────────────────┐
   │ L1 colleges ─1→N─ Cutoff / Rank           │  ◄── live product tables
   │ (College Code, carries NIRF Code)         │      (public, denormalized)
   └──────────────────────────────────────────┘
```

**Read it as:** demand/admissions knowledge flows up from TNEA (branch-grained), quality/outcome knowledge flows up from NIRF (institution-grained), and they only meet in two places — the computed parameter layer (L4) and the denormalized product tables (L1). The `College Code ↔ NIRF Code` mapping is the load-bearing bridge; its completeness determines how much of the catalog the AI can reason about.

---

## 3. Knowledge Categories

1. **Admissions & Demand** — `Cutoff`, `Rank`, `tnea_cutoffs`, `tnea_ranks`, `tnea_allotments` → *"Can I get in? How competitive/popular is it?"*
2. **Outcomes & ROI** — `nirf_placement_higher_studies`, denormalized outcome columns in L1 → *"What happens after I graduate?"*
3. **Teaching & Faculty Quality** — `nirf_faculty` → *"Who will teach me?"*
4. **Institutional Investment & Finance** — `nirf_financial_capital`, `nirf_financial_operational` → *"Is the college resourced?"*
5. **Research & Innovation** — `nirf_ipr`, `nirf_sponsored_research`, `nirf_consultancy`, `nirf_phd_graduated` → *"Is it research-active?"*
6. **Student Body & Inclusion** — `nirf_student_strength` → *"Who are my peers?"*
7. **Accreditation & Trust** — `nirf_accreditation` → *"Is it credible?"*
8. **Campus, Sustainability & Accessibility** — `nirf_sdg_*`, `nirf_institutions.pcs_*`, `nirf_mea_iks` → *"What's the campus like / is it accessible?"*
9. **Composite Intelligence** — L4 parameters + `PowerScore`/`IdleOutputIndex` → *"Just tell me how good it is."*
10. **User & Behavioral** — L5 operational tables → personalization/entitlements (not college facts).

---

## 4. Missing Knowledge (gaps that limit the counselor)

**Structurally absent datasets** (the biggest gaps — the counselor cannot answer these today):
- **Fees / tuition / scholarships (student-facing).** There is *no* fee dataset. `nirf_financial_*` is institutional *expenditure*, not what a student pays. "How much will it cost me?" is unanswerable — a critical counseling gap.
- **Counselling process & important dates.** No calendar/schedule/round-timeline dataset. "When is choice filling / when are rounds?" cannot be answered from data.
- **Category-wise seat matrix.** L1/L2 hold cutoff *marks/ranks* per community but **not seat *counts* per category** per branch. Reservation-aware "how many OC/BC/SC seats exist" is not represented.
- **Company/recruiter-level placement.** Only median salary + counts; no recruiter list, no salary distribution, no branch-wise placement.
- **Branch-level quality/finance/faculty.** NIRF is institution-grained; nothing attributes faculty/finance/research to a specific branch.
- **Geospatial / location intelligence.** Only `pincode` and `District`; no coordinates, distance-from-home, hostel, city cost-of-living.
- **Reviews / sentiment / student experience.** No qualitative reputation signal.
- **Program/branch accreditation (NBA) & autonomy status.** Present body data is filtered to NAAC only.

**Latent (present but unused) knowledge:** `nirf_sdg_quantitative`, `nirf_mea_iks`, and `user_choice_filling_data` are loaded/collected but not surfaced — activatable without new sourcing.

**Data-quality debts that degrade knowledge reliability:**
- Community cutoff/rank columns in `Cutoff`/`Rank` are **text-typed** (numeric comparison/sorting is unreliable).
- L1 tables have **no year dimension** (no volatility/trend at the product layer).
- Opaque, non-reproducible indices (`PowerScore`, `IdleOutputIndex`, `careerOutcome`) — not explainable by the AI.
- Shallow NIRF history (many trends computed over just `2023-24` vs `2022-23`).
- Fragile identifier bridge (`College Code ↔ NIRF Code`); one code path conflates `counselling_code` with `nirf_id`.
- **Governance:** L5 PII (`profiles`, `user_referrals`) is readable by the anon role — must be closed before any AI surface reads user data.

---

## 5. Recommended Future Datasets (to unlock the counselor)

Prioritized by counseling impact:

| Priority | Dataset | Unlocks | Sourcing |
|---|---|---|---|
| **P0** | **Fee & scholarship schedule** (per college/branch/category: tuition, hostel, fee waivers) | "What will it cost me?" affordability advice | TNEA fee circulars / college sites |
| **P0** | **Counselling calendar** (rounds, dates, deadlines, eligibility rules) | Time-aware guidance, deadline nudges | TNEA official schedule |
| **P0** | **Category seat matrix** (seats per community per branch per year) | Reservation-accurate eligibility & odds | TNEA allotment publications |
| **P1** | **Recruiter/placement detail** (companies, role, salary distribution, branch-wise) | Credible ROI & branch selection | Institute placement reports |
| **P1** | **Geo/location & living cost** (coords, distance, hostel availability, city index) | Location-aware, distance-from-home advice | Geocoding + surveys |
| **P1** | **Branch/program accreditation (NBA) & autonomy** | Program-level trust signals | NBA + AICTE |
| **P2** | **Reviews / sentiment** (verified student feedback) | Experience/culture narratives | First-party collection via CYC |
| **P2** | **Historical closing-rank series at L1 granularity** (add `year`) | Volatility/trend in the product layer | Re-key existing L2 into product tables |
| **P2** | **Explainable score definitions** (documented `PowerScore`/`IdleOutputIndex` recipes) | AI can *justify* recommendations | Internal — formalize the pipeline |

---

## 6. Audit Conclusion (architect's view)

CYC already holds a **rich, multi-dimensional knowledge base** — admissions demand (time-aware), institutional quality/outcomes, and a strong pre-computed intelligence layer (L4) that is the natural reasoning surface for an AI counselor. The knowledge is **broad on "how good is this college"** and **weak on "what will it cost, when do I apply, and how many seats are there for my category."**

Before building any AI capability on top of this, three foundations must be treated as prerequisites, in order:
1. **Close the governance gap** (PII readable by anon).
2. **Repair the data-quality debts** (numeric typing, identifier bridge integrity, explainable scores).
3. **Fill the P0 structural gaps** (fees, counselling calendar, category seat matrix) — without these, the counselor will be confidently silent on the questions students ask most.

This audit is the input to the next document; it deliberately stops at *understanding the knowledge* and makes no chatbot, embedding, or retrieval design decisions.
