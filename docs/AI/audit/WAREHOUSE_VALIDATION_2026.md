# Warehouse Validation Report — 2026 Dataset Integration

**Phase:** validation only. **No** recommendation, retrieval, ranking, confidence,
prompt, or LLM code was touched. Nothing committed, pushed, or merged. All figures
are from a real build: `buildWarehouseFromDirectory(CYC_DATA_DIR)` on
`feature/ai-counselor-v2`, cross-checked against `2026_final_NIRF_data.csv`.

---

## STEP 1 — Warehouse audit

| Metric | Value | Note |
|---|---:|---|
| Colleges **before** merge | **324** | base catalog |
| Colleges **after** merge | **324** | merge *enriches*, never adds → count unchanged |
| **Enriched** colleges | **262** | one 2026 profile attached each |
| **Newly added** colleges | **0** | additive-safe (by design) |
| **Unmatched** 2026 rows | **194** | candidates, not injected |
| Duplicate colleges from the **merge** | **0** | `byCollege.size (262) == matched (262)` ✅ |
| Duplicate colleges in the **base warehouse** | **161 colleges / 64 NIRF ids** | ⚠️ pre-existing (see below) |
| Duplicate NIRF ids — *2026 dataset* | **0** | 206 distinct |
| Duplicate NIRF ids — *warehouse* | **64** | shared across 161 colleges ⚠️ |
| Duplicate CollegeCodes — *2026 dataset* | **0** | 467 distinct |
| Duplicate CollegeCodes — *warehouse* | n/a | colleges store **0** codes |

**Missing fields among the 262 enriched colleges:**

| Field | Missing | Present |
|---|---:|---:|
| District | 21 | 241 |
| OC Cutoff | 36 | 226 |
| Median Salary | 60 | 202 |
| Placement % | 60 | 202 |
| PowerScore | 61 | 201 |
| CareerOutcome | 60 | 202 |

### ⚠️ Pre-existing: 64 NIRF ids shared by 161 colleges
324 colleges → 306 have a NIRF id, but only **209 distinct** ids; **64 ids are shared
by ≥2 colleges** (161 colleges total). Examples of *different* colleges sharing one id:

- `IR-E-C-27074` → **A.V.C. College**, **R.V.S. College**, **V.V. College** of Engineering
- `IR-E-C-49130` → **Adhi**, **Asian**, **Salem**, **SCAD** Colleges of Engineering
- `IR-E-C-16571` → **Aalim Muhammed Salegh**, **Mohamed Sathak A.J.** Colleges

This is a **base-warehouse** defect (from `institutions.csv` NIRF ids), **not** caused by
the 2026 work — but the NIRF-based merge inherits it (see Architecture Risks).

---

## STEP 2 — Matching verification

| Strategy | Matches | Failures | Why it fails |
|---|---:|---:|---|
| **NIRF Code** | **206** | 0 | every NIRF-coded row resolved |
| **CollegeCode** | **0** | 466 | existing colleges store **0** counselling codes |
| **Name** | **56** | 194 unmatched | no NIRF + `comparisonKey` name no-match |

### Why CollegeCode matched 0 — investigated, **EXPECTED (not a bug)**
- Colleges are built with `counsellingCodes: []` **always** — [college-transform.ts:122](../../lib/knowledge/transform/college-transform.ts#L122).
- The crosswalk states it explicitly — [crosswalk.ts:7-10](../../lib/knowledge/mapping/crosswalk.ts#L7-L10): *"the source files contain no `counselling_code → nirf_id` mapping, so the TNEA admission side cannot be auto-linked… the future counselling-code dataset will populate"* it.
- The warehouse **knows 466 distinct TNEA codes** (a flat universe from `Ftnea_cutoffs.csv`) but links **0** to colleges (`collegesWithCounselling = 0`).

**Verdict:** `existingCollegesWithCounsellingCodes = 0` is **by design** — the pre-2026
sources never carried a code→college mapping. **The 2026 dataset is itself the missing
bridge** (it pairs `CollegeCode` with `NIRF Code` on 206 rows) → it can *backfill*
`counsellingCodes` in a later phase, which would then make code-based matching work.

---

## STEP 3 — Data quality / coverage (of 492 rows)

| Field | Populated | Missing | Coverage |
|---|---:|---:|---:|
| District | 431 | 61 | **87.6%** |
| OC Cutoff | 366 | 126 | **74.4%** |
| Placement % | 202 | 290 | 41.1% |
| Median Salary | 202 | 290 | 41.1% |
| Passing % | 202 | 290 | 41.1% |
| Higher Studies % | 202 | 290 | 41.1% |
| PowerScore | 201 | 291 | 40.9% |
| CareerOutcome | 202 | 290 | 41.1% |
| Scholarship % | 206 | 286 | 41.9% |
| Seats Filled | 201 | 291 | 40.9% |
| Women Students | 206 | 286 | 41.9% |
| Outside Students | 206 | 286 | 41.9% |
| Total Intake | 205 | 287 | 41.7% |

**Two tiers:** ~202 fully-profiled colleges (metrics present) + ~290 identity-only rows
(name + code + district + often cutoff). District & cutoff coverage are high; all
performance metrics sit at ~41%.

---

## STEP 4 — Manual validation (30-college spread sample)

Selected deterministically (every ~8th matched college by source row) and **each field
cross-checked against the raw CSV cell**. Result: **30 / 30 exact match** (`name`,
`district`, `ocCutoff`, `salary` verified byte-for-byte). Representative rows:

| College | District | OC | Salary | Plc% | Power | Career | By | Row | CSV✓ |
|---|---|---:|---:|---:|---:|---:|---|---:|:--:|
| Sri Krishna College of Engg & Tech (Autonomous) | Coimbatore | 192 | 700000 | 85.24 | 96.43 | 93.56 | nirf | 1 | ✅ |
| Rajalakshmi Institute of Technology (Autonomous) | Chennai | 191 | 508667 | 96.45 | 92.33 | 99.88 | nirf | 9 | ✅ |
| Sri Venkateswara College of Engg (Autonomous) | Chennai | 192 | 566667 | 72.49 | 86.86 | 91.36 | nirf | 17 | ✅ |
| Chennai Institute of Technology (Autonomous) | Chennai | 196 | 426585 | 73.02 | 82.5 | 80.71 | nirf | 25 | ✅ |
| Meenakshi Sundararajan Engg College (Autonomous) | Chennai | 180.5 | 406667 | 73.01 | 76.88 | 76.94 | nirf | 33 | ✅ |
| N.P.R College of Engg & Tech (Autonomous) | Dindigul | 154 | 330000 | 85.46 | 74.51 | 87.22 | nirf | 41 | ✅ |
| R.M.K. Engineering College (Autonomous) | Thiruvallur | 190 | 458333 | 59.45 | 65.97 | 70.43 | nirf | 57 | ✅ |

*(All 30 verified true; the full set is reproducible from the harness.)*

---

## STEP 5 — District validation

**Top districts by row count:** *(blank) 61, Coimbatore 56, Chennai 56, Tiruchirappalli 29,
Kanyakumari 27, Namakkal 22, Salem 17, Kancheepuram 15, Thiruvallur 15, Tirunelveli 14,
Erode 13, Chengalpattu 12, Virudhunagar 11, Thanjavur 11, Dindigul 10.* (38 distinct districts.)

**Requested districts — verified members belong there:**

| District | Count | Sample members (correct) |
|---|---:|---|
| Coimbatore | 56 | Sri Krishna CET, Rathinam Technical Campus |
| Chennai | 56 | Easwari Engg College, Rajalakshmi Inst. of Tech |
| **Madurai** | **9** | Thiagarajar College of Engg, Velammal CET |
| Salem | 17 | Knowledge Inst. of Tech, Dhirajlal Gandhi CoT |
| Tiruchirappalli | 29 | K Ramakrishnan CoT, M.I.E.T. Engg College |
| Erode | 13 | Nandha Engg College, Kongu Engg College |

All sampled colleges genuinely belong to the stated district. (Madurai is **not** a top-15
district — only 9 rows — worth noting for coverage expectations.)

---

## STEP 6 — Colleges in the 2026 dataset but NOT in the warehouse (194)

All 194 unmatched rows: **193 have a CollegeCode, 0 have a NIRF code**, and none name-matched
an existing college. Reason: no NIRF id to bridge + `CollegeCode` can't bridge (colleges store
no codes) + normalized-name no-match. **Full list in Appendix A.** First rows:

| College | District | CollegeCode | NIRF |
|---|---|---|---|
| A R Engineering College | Viluppuram | 1436 | — |
| A V S Engineering College | Salem | 2636 | — |
| A.R College of Engineering and Technology | Tirunelveli | 4937 | — |
| A.R.J College of Engineering and Technology | Thiruvarur | 3821 | — |
| Aishwarya College of Engineering and Technology | Erode | 2332 | — |

### Should these be (A) merged into existing, or (B) new canonical colleges?
**Recommendation: mostly (B) — new canonical colleges**, keyed by `CollegeCode`, but **only
after a name-similarity dedup pass**:
- These are the **non-NIRF "long tail"** of TNEA colleges (the base warehouse is NIRF-centric;
  the 2026 file has ~194 more real colleges without NIRF data).
- **Risk of (B) done blindly:** a few may be *existing* colleges under a name variant that
  `comparisonKey` missed (e.g. suffix/abbreviation differences) → would create true duplicates.
- **So:** (B) new colleges, gated by (1) a fuzzy name/token review against the 324, and
  (2) treating `CollegeCode` as their stable id. Do **not** auto-add without that review.

---

## STEP 7 — Architecture review

**What is good**
- Fully **additive**: new module `lib/knowledge/nirf2026`, optional source (warehouse still
  builds without the file), zero mutation of existing entities, no circular deps, TS clean, 490/490 tests.
- **Parse fidelity is exact** (30/30 CSV cross-check) and the **no-duplicate-college** guarantee holds.
- NIRF-first cascade is the right call; a full merge audit is produced.

**What is incorrect / weak**
- **CollegeCode matching is dead (0)** — not wrong, but the stated merge rule can't fire until
  `counsellingCodes` are backfilled. The plumbing is right; the data isn't there yet.
- **Name fallback (56) is low-confidence** — exact `comparisonKey`; `(Autonomous)` suffixes both
  suppress real matches and (via source dups) create the 36 duplicate rows.

**What is risky**
- 🔴 **Base warehouse: 64 NIRF ids shared by 161 colleges.** Because `byNirf` is first-wins, a 2026
  row matching a shared id enriches an **arbitrary one** of several colleges → some of the 206 "NIRF"
  matches may attach to the *wrong* college. The 30-sample verified *profile↔CSV* fidelity, **not**
  target-college correctness for shared ids.
- **Salary/placement/scores ~41% coverage** — thin for any future placement-based ranking.
- **`ocCutoff` is OC-only** — eligibility for BC/MBC/SC/ST and per-branch cutoffs still absent.

**What will break later**
- If recommendation starts reading `nirf2026.byCollege` while the 64 shared NIRF ids remain,
  it will surface enrichment on the wrong college for those cases.
- Auto-adding the 194 unmatched without a dedup pass will create real duplicate colleges.
- Composite scores (`PowerScore`, `IdleOutputIndex`, `careerOutcome`) are **undefined** —
  unsafe to rank on until their formulas are documented.

**What should be redesigned before production**
1. **Fix NIRF-id uniqueness** in the base catalog (dedupe the 64 shared ids) *before* trusting NIRF matches.
2. **Backfill `counsellingCodes`** from the 2026 NIRF↔Code pairs → enables real code-based matching.
3. Decide the **194 unmatched** policy (recommend B + dedup).
4. Add a **suffix-stripping** normalization for name matching.
5. Document the **composite-score** semantics.

---

## STEP 8 — Final report

- ✅ **Warehouse:** 324 colleges (306 with NIRF, 209 distinct), 262 enriched, 0 added, 194 unmatched.
- ✅ **Merge:** 206 NIRF + 56 name + 0 code; 0 merge-duplicate colleges; 36 source dups de-duplicated.
- ✅ **Coverage:** district 87.6%, cutoff 74.4%, performance metrics ~41%.
- ✅ **Matching:** NIRF works; CollegeCode dead-by-design (466 codes known, 0 linked); name low-confidence.
- ✅ **Data-quality issues:** ~59% missing performance metrics; `State` spelling `Tamilnadu`≠`Tamil Nadu`;
  OC-only cutoff; opaque composite scores; `(Autonomous)` suffixes.
- ✅ **Missing data:** enriched-college gaps — cutoff 36, salary/placement/career ~60, powerScore 61.
- ✅ **Duplicate analysis:** merge 0; **base warehouse 64 shared NIRF ids / 161 colleges (pre-existing)**.
- ✅ **Architecture risks:** shared-NIRF mis-attribution; dead CollegeCode path; thin metric coverage.
- ✅ **Recommendations:** (1) fix NIRF-id uniqueness, (2) backfill codes from 2026, (3) B+dedup for the 194,
  (4) suffix-strip names, (5) document composite scores — **all before** any recommendation change.

**Nothing was modified, committed, pushed, or merged. Awaiting approval for the next phase.**

---

## Appendix A — all 194 unmatched colleges

Format: `College | District | CollegeCode | NIRF`

```
A R Engineering College | Viluppuram | code=1436 | nirf=-
A V S Engineering College | Salem | code=2636 | nirf=-
A.R College of Engineering and Technology | Tirunelveli | code=4937 | nirf=-
A.R.J College of Engineering and Technology | Thiruvarur | code=3821 | nirf=-
Aishwarya College of Engineering and Technology | Erode | code=2332 | nirf=-
Alpha College of Engineering | Chennai | code=1228 | nirf=-
AMRITA College of Engineering and Technology | Kanyakumari | code=4972 | nirf=-
Angel College of Engineering and Technology | Tiruppur | code=2733 | nirf=-
Anna University Regional Campus - Coimbatore | Coimbatore | code=2025 | nirf=-
Anna University Regional Campus - Tirunelveli | Tirunelveli | code=4020 | nirf=-
Annai Mathammal Sheela Engineering College | Namakkal | code=2602 | nirf=-
Annai Mira College of Engineering and Technology | Ranipet | code=1137 | nirf=-
Annai Teresa College of Engineering | Kallakurichi | code=1402 | nirf=-
Annai Vailankanni College of Engineering | Kanyakumari | code=4999 | nirf=-
Annai Veilankannis College of Engineering | Chennai | code=1133 | nirf=-
Annamalai University Faculty of Engineering and Technology | Cuddalore | code=5 | nirf=-
Annamalaiar College Of Engineering | Thiruvannamalai | code=1524 | nirf=-
Annapoorana Engineering College (Autonomous) | Salem | code=2648 | nirf=-
Apollo Engineering College | Kancheepuram | code=1230 | nirf=-
Ariyalur Engineering College | Tiruchirappalli | code=3462 | nirf=-
ARM College of Engineering and Technology | Chengalpattu | code=1232 | nirf=-
ARS College of Engineering | Chengalpattu | code=1334 | nirf=-
Arul Tharum VPMM College of Engineering and Technology (Formerly V.P.Muthaiah Pillai Meenakshi Ammal Engineering College for Women) | Virudhunagar | code=4979 | nirf=-
Arunachala Hitech Engineering College (formerly Lourdes Mount College of Engineering and Technology) | Kanyakumari | code=4677 | nirf=-
Arunai Engineering College (Autonomous) | Thiruvannamalai | code=1504 | nirf=-
As-Salam College of Engineering and Technology | Thanjavur | code=3855 | nirf=-
Bannari Amman Institute of Technology (Autonomous) | Erode | code=2702 | nirf=-
Bhajarang Engineering College | - | code=1102 | nirf=-
Bharath Niketan Engineering College | Theni | code=5902 | nirf=-
C M S College of Engineering and Technology | Coimbatore | code=2772 | nirf=-
Central Electrochemical Research Institute CECRI) | - | code=5012 | nirf=-
Central Institute of Petrochemicals Engineering and Technology (Formerly Central Institute of Plastics Engineering and Technology) (CIPET) | - | code=1321 | nirf=-
Chendhuran College of Engineering and Technology | Pudukkottai | code=3926 | nirf=-
Chennai Institute of Technology and Applied Research Sarathy Nagar Puthuper | Chennai | code=1398 | nirf=-
Cheran College of Engineering | - | code=2355 | nirf=-
Cherraan College of Technology | Tiruppur | code=2378 | nirf=-
Christian College of Engineering and Technology | Dindigul | code=5703 | nirf=-
CMS College of Engineering | Namakkal | code=2635 | nirf=-
DMI College of Engineering (Autonomous) | Chennai | code=1202 | nirf=-
Dr. Nagarathinams College of Engineering | - | code=2662 | nirf=-
Easa College of Engineering and Technology | Coimbatore | code=2749 | nirf=-
Einstein College of Engineering | Tirunelveli | code=4980 | nirf=-
G.T.N COLLEGE OF TECHNOLOGY | - | code=5545 | nirf=-
Ganadipathy Tulsi's Jain Engineering College | Vellore | code=1507 | nirf=-
Ganapathy Chettiar College of Engineering and Technology | Ramanathapuram | code=5924 | nirf=-
Ganesh College of Engineering | Salem | code=2341 | nirf=-
Good Shepherd College of Engineering and Technology | Kanyakumari | code=4686 | nirf=-
HINDUSTHAN COLLEGE OF ENGINEERING | - | code=2777 | nirf=-
Holy Cross Engineering College | Thoothukudi | code=4934 | nirf=-
Immanuel Arasar J.J. College of Engineering | - | code=4932 | nirf=-
Indian Institute of Handloom Technology | - | code=2343 | nirf=-
Indira Institute of Engineering and Technology | Thiruvallur | code=1229 | nirf=-
International Maritime Academy | - | code=1158 | nirf=-
J N N Institute of Engineering Ushaa Garden Kannigaipair | Thiruvallur | code=1126 | nirf=-
J.J. College of Engineering and Technology | Tiruchirappalli | code=3807 | nirf=-
J.K.K.Nataraja College of Engineering and Technology | Namakkal | code=2647 | nirf=-
Jagannath Institute of Technology | - | code=1435 | nirf=-
Jainee College of Engineering and Technology | Dindigul | code=5537 | nirf=-
Jairupaa College of Engineering | Tiruppur | code=2350 | nirf=-
Jamal Mohamed College of Engineering | - | code=5546 | nirf=-
Jawahar Engineering College | - | code=1447 | nirf=-
Jaya Sakthi Engineering College | Chennai | code=1416 | nirf=-
Jayalakshmi Institute of Technology | Dharmapuri | code=2640 | nirf=-
Jayam College of Engineering and Technology | - | code=2606 | nirf=-
Jayamatha Engineering College | Kanyakumari | code=4956 | nirf=-
Jayaram College of Engineering and Technology | Tiruchirappalli | code=3808 | nirf=-
Jei Mathaajee College of Engineering | Kancheepuram | code=1235 | nirf=-
Karaikudi Institute of Technology and Karaikudi Institute of Management | Sivagangai | code=5533 | nirf=-
Kingston Engineering College | Vellore | code=1520 | nirf=-
Krishnasamy College of Engineering and Technology | Cuddalore | code=3410 | nirf=-
Kurinji College of Engineering and Technology | Tiruchirappalli | code=3809 | nirf=-
Lord Jegannath College of Engineering and Technology | Kanyakumari | code=4983 | nirf=-
Lord Venkateshwaraa Engineering College | - | code=1205 | nirf=-
M.E.T. Engineering College | Kanyakumari | code=4929 | nirf=-
MADRAS ENGINEERING COLLEGE | - | code=1203 | nirf=-
Maha Barathi Engineering College | Kallakurichi | code=1430 | nirf=-
MAHALAKSHMI TECH CAMPUS (FORMERLY MAHALAKSHMI ENGINEERING COLLEGE - TIRUCHIRAPPALLI) | - | code=1339 | nirf=-
Mahendra Engineering College for Women | Namakkal | code=2638 | nirf=-
Mahendra Institute of Engineering and Technology | - | code=2665 | nirf=-
MAR Ephraem College of Engineering & Technology | Kanyakumari | code=4928 | nirf=-
Maria College of Engineering and Technology | Kanyakumari | code=4927 | nirf=-
Meenakshi Ramaswamy Engineering College | Tiruchirappalli | code=3857 | nirf=-
MNSK College of Engineering | Pudukkottai | code=3923 | nirf=-
Mohamed Sathak A.J. Academy of Architecture | - | code=1400 | nirf=-
Mookambigai College of Engineering | Pudukkottai | code=3812 | nirf=-
N.S.N. College of Engineering and Technology | Madurai | code=2327 | nirf=-
Narayanaguru College of Engineering | Kanyakumari | code=4977 | nirf=-
Nellai College of Engineering (Formerly National College of Engineering) | Tirunelveli | code=4961 | nirf=-
Nelliandavar Institute of Technology | Ariyalur | code=3466 | nirf=-
Noorul Islam Centre for Higher Education | - | code=- | nirf=-
Noorul Islam College of Engineering and Technology | Kanyakumari | code=4986 | nirf=-
OASYS Institute of Technology | Tiruchirappalli | code=3782 | nirf=-
Oxford Engineering College | Tiruchirappalli | code=3813 | nirf=-
P T Lee Chengalvaraya Naicker College of Engineering and Technology | Kancheepuram | code=1226 | nirf=-
P.B. College of Engineering | Kancheepuram | code=1222 | nirf=-
P.R. Engineering College | Thanjavur | code=3814 | nirf=-
P.T.R. College of Engineering and Technology | Madurai | code=5911 | nirf=-
Paavai College of Engineering | Namakkal | code=2628 | nirf=-
Paavai College of Technology | - | code=2657 | nirf=-
Pallavan College of Engineering | Kancheepuram | code=1209 | nirf=-
Pandian Saraswathi Yadav Engineering College | Sivagangai | code=5912 | nirf=-
Panimalar Engineering College Chennai City Campus | - | code=1533 | nirf=-
Panimalar Institute of Technology | - | code=1231 | nirf=-
Park College of Technology | Coimbatore | code=2768 | nirf=-
Pavendar Bharathidasan College of Engineering and Technology | Tiruchirappalli | code=3815 | nirf=-
PET Engineering College | Tirunelveli | code=4966 | nirf=-
PGP College of Engineering and Technology | Namakkal | code=2612 | nirf=-
PMR Engineering College | Chennai | code=1125 | nirf=-
Podhigai College of Engineering and Technology | Thiruppattur | code=1525 | nirf=-
Pollachi Institute of Engineering and Technology | Coimbatore | code=2354 | nirf=-
Prince Shri Venkateshwaraa Padmavathy Engineering College (Autonomous) | Chennai | code=1414 | nirf=-
Quannta School of Software Engineering (formerly E S Engineering College) | Viluppuram | code=1428 | nirf=-
R V S Technical Campus Coimbatore (Autonomous) | Coimbatore | code=2776 | nirf=-
R.M.Engineering College (formerly Chendu College of Engineering and Technology) | Chengalpattu | code=1444 | nirf=-
Rajas Institute of Technology | - | code=4948 | nirf=-
RANIPPETTAI ENGINEERING COLLEGE | Ranipet | code=1511 | nirf=-
Renganayagi Varatharaj College of Engineering | Virudhunagar | code=4676 | nirf=-
RVS School of Engineering and Technology | Dindigul | code=5862 | nirf=-
S K R Engineering College | Chennai | code=1213 | nirf=-
S. Veerasamy Chettiar College of Engineering and Technology | Tenkasi | code=4967 | nirf=-
S.K.P. Engineering College | Thiruvannamalai | code=1512 | nirf=-
SACS M.A.V.M.M. Engineering College | Madurai | code=5915 | nirf=-
SAMS College of Engineering and Technology | Thiruvallur | code=1124 | nirf=-
Sapthagiri College of Engineering | Dharmapuri | code=2616 | nirf=-
Saraswathy College of Engineering and Technology | Viluppuram | code=1449 | nirf=-
Sardar Raja College of Engineering | Tenkasi | code=4968 | nirf=-
SASI CREATIVE SCHOOL OF ARCHITECTURE | - | code=2361 | nirf=-
Satyam College of Engineering and Technology | Kanyakumari | code=4943 | nirf=-
SBM College of Engineering and Technology | Dindigul | code=5930 | nirf=-
School of Architecture and Planning | - | code=3 | nirf=-
Sembodai Rukmani Varatharajan Engineering College | Nagapattinam | code=3859 | nirf=-
Sengunthar College of Engineering | - | code=2629 | nirf=-
Shanmuganathan Engineering College | Pudukkottai | code=3918 | nirf=-
Shikshaa Institute of Advanced Technologies (formerly Vi Institute of Technology) | - | code=1333 | nirf=-
Shivani Engineering College | Tiruchirappalli | code=3844 | nirf=-
Shree Motilal Kanhaiyalal (SMK)Fomra Institute of Technology | Chengalpattu | code=1313 | nirf=-
Shree Sathyam College of Engineering and Technology | Salem | code=2346 | nirf=-
Shri Angalamman College of Engineering and Technology | Tiruchirappalli | code=3802 | nirf=-
Sivaji College of Engineering and Technology | Kanyakumari | code=4938 | nirf=-
SMR East Coast College of Engineering and Technology | - | code=3451 | nirf=-
Sree Krishna College of Engineering | Vellore | code=1438 | nirf=-
Sri Balaji Chockalingam Engineering College | Thiruvannamalai | code=1513 | nirf=-
Sri Krishna College of Engineering | Ranipet | code=1526 | nirf=-
Sri Krishna College of Technology (Autonomous) | Coimbatore | code=2722 | nirf=-
Sri Krishna Institute of Technology | - | code=1335 | nirf=-
Sri Nandhanam College of Engineering and Technology | Vellore | code=1514 | nirf=-
Sri Raajaraajan College of Engineering and Technology | Sivagangai | code=5502 | nirf=-
Sri Ramakrishna College of Engineering | Perambalur | code=3454 | nirf=-
Sri Ramanujar Engineering College | Chennai | code=1426 | nirf=-
Sri Rangapoopathi College of Engineering | Viluppuram | code=1445 | nirf=-
Sri Sai Ram Engineering College (Autonomous) | Chennai | code=1419 | nirf=-
Sri Sai Ranganathan Engineering College | Coimbatore | code=2737 | nirf=-
Sri Subramanya College of Engineering and Technology | - | code=5720 | nirf=-
Sri Venkateswara Institute of Science and Technology | Thiruvallur | code=1121 | nirf=-
Sri Vidya College of Engineering and Technology | Virudhunagar | code=4996 | nirf=-
SRI VIGNESH COLLEGE OF ENGINEERING AND TECHNOLOGY | - | code=3477 | nirf=-
SRM Madurai College for Engineering and Technology (Formely Madurai Institute of Engineering and Technology) | Sivagangai | code=5842 | nirf=-
ST. LOURDES ENGINEERING COLLEGE (Formerly Madha Institute of Engineering and Technology) | Chennai | code=1243 | nirf=-
Studyworld College of Engineering | Coimbatore | code=2770 | nirf=-
Suguna College of Engineering | Coimbatore | code=2360 | nirf=-
Sun College of Engineering and Technology | - | code=4925 | nirf=-
Surya College of Engineering | Tiruchirappalli | code=3460 | nirf=-
Surya Group of Institutions | Viluppuram | code=1434 | nirf=-
T.S.M.Jain College of Technology | Kallakurichi | code=1415 | nirf=-
Thamirabharani Engineering College (Autonomous) | Tirunelveli | code=4669 | nirf=-
Thirumalai Engineering College | Kancheepuram | code=1517 | nirf=-
Tittagudi Sengunthar Engineering College (Formerly Dr.Navalar Nedunchezhiyan College of Engineering) | Cuddalore | code=3822 | nirf=-
Udaya School of Engineering | Kanyakumari | code=4978 | nirf=-
Ultra College of Engineering and Technology | Chennai | code=5942 | nirf=-
Universal College of Engineering and Technology | Tirunelveli | code=4675 | nirf=-
University College of Engineering | Viluppuram | code=1013 | nirf=-
University College of Engineering | Viluppuram | code=1014 | nirf=-
University College of Engineering | Thiruvannamalai | code=1015 | nirf=-
University College of Engineering | Chennai | code=1026 | nirf=-
University College of Engineering | Tiruchirappalli | code=3011 | nirf=-
University College of Engineering | Ariyalur | code=3016 | nirf=-
University College of Engineering | Nagapattinam | code=3018 | nirf=-
University College of Engineering | Chennai | code=3019 | nirf=-
University College of Engineering | Thanjavur | code=3021 | nirf=-
University College of Engineering | Ramanathapuram | code=5017 | nirf=-
University College of Engineering | Dindigul | code=5022 | nirf=-
University Departments of Anna University | - | code=2 | nirf=-
University Departments of Anna University | Chengalpattu | code=4 | nirf=-
University V.O.C. College of Engineering | - | code=4024 | nirf=-
V S A Group of Institutions | Salem | code=2658 | nirf=-
Vaigai College of Engineering | Madurai | code=5532 | nirf=-
Vandayar Engineering College | Thanjavur | code=3848 | nirf=-
Varuvan Vadivelan Institute of Technology | Dharmapuri | code=2641 | nirf=-
Veerammal Engineering College | Dindigul | code=5851 | nirf=-
Vetri Vinayaha College of Engineering and Technology | Tiruchirappalli | code=3850 | nirf=-
Vidyaa Vikas College of Engineering and Technology | Namakkal | code=2633 | nirf=-
Vins Christian Women's College of Engineering | - | code=4945 | nirf=-
Vishnu Lakshmi College of Engineering and Technology | Coimbatore | code=2368 | nirf=-
Vivekanandha College of Technology for Women | Namakkal | code=2661 | nirf=-
```
