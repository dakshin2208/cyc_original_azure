# Recommendation Engine — Architecture Audit & Redesign Plan

**Read-only audit + design. No code changed. Awaiting approval before implementation.**
Every proposed change **preserves existing public APIs** and uses seams that already
exist in the engine — this is *completion + repair*, not a redesign.

---

## STEP 1 — Full pipeline trace

| # | Stage | File · Function | Input | Output | Purpose |
|---|---|---|---|---|---|
| 1 | Intent | [query-parser.ts](../../lib/ai/orchestration/query/query-parser.ts) `parse` → [intent-classifier.ts](../../lib/ai/orchestration/query/intent-classifier.ts) | raw question | `intent`, `intentConfidence` | classify (recommend/eligibility/compare/…) |
| 2 | Entity | [entity-extractor.ts:126](../../lib/ai/orchestration/query/entity-extractor.ts#L126) `extract` | normalized + tokens | `{branch, community, studentCutoff, location, colleges[]}` | pull structured fields |
| 3 | Route | [ai-orchestrator.ts:136](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L136) `runEngines` | `ParsedQuery` | `RecommendationResult[]` | pick a `reco.*` method by intent |
| 4 | Candidate gen + rank | [executor.ts:78](../../lib/recommendation/strategies/executor.ts#L78) `rankProfiles` | `RankSpec + request` | ranked `RecommendationResult[]` | score all profiles → sort → top-K |
| 5 | Scoring | [scoring-engine.ts](../../lib/recommendation/scoring/scoring-engine.ts) `score` | `CollegeProfile + weights` | `RecommendationScore` | weighted dimension sum |
| 6 | Eligibility | [eligibility-engine.ts](../../lib/recommendation/eligibility/eligibility-engine.ts) `assess` (uses [cutoff-lookup.ts](../../lib/recommendation/data/cutoff-lookup.ts)) | college+cutoff+community | `EligibilityAssessment` | band safe/reach/… (annotate only) |
| 7 | Evidence | [ai-orchestrator.ts:220](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L220) `collector.collect` | recs+facts | evidence bundle | ids the LLM may cite |
| 8 | Prompt | [opinion-prompt-builder.ts:78](../../lib/opinion/prompt/opinion-prompt-builder.ts#L78) `buildOpinionPrompt` | context | messages | system+user prompt |
| 9 | LLM | [adapter.ts:98](../../lib/ai/llm/adapter.ts#L98) → [openai-provider.ts:56](../../lib/ai/llm/providers/openai/openai-provider.ts#L56) | prompt | text | explain (Azure OpenAI; **not invoked — no creds**) |
| 10 | Response | [opinion-formatter.ts:72](../../lib/opinion/formatter/opinion-formatter.ts#L72) `formatOpinion` | validated llm | ChatResponse | final answer + citations |

---

## STEP 2 — Query walkthrough (actual objects)

**`"CSE in Coimbatore with 190 cutoff BC"`**
```
PARSED: { intent:"eligibility_query", branch:"Computer Science and Engineering",
          community:"BC", studentCutoff:190, location:"coimbatore",
          colleges:["Coimbatore Institute of Engineering and Technology"] }   ← 🔴 RC1
RECOMMENDATIONS: [ Coimbatore Institute of Engineering and Technology (rank #227, score 0.31) ]
ELIGIBILITY: { category:"unknown", closingCutoff:null, basis:"no_closing_cutoff_available" }  ← RC4
CONFIDENCE: "high"   ← 🔴 RC5 (high, on a wrong answer)
```

**`"best CSE college"`** → `RECOMMENDS: Bharathidasan University` (a general university). Branch ignored (RC3).
**`"colleges in Coimbatore"`** → `PARSED.colleges:["Coimbatore Institute of Engineering and Technology"]`; returns that one college (RC1); location `coimbatore` extracted but **dropped** (RC2).
**`"MBBS in Chennai"`** → sometimes an engineering rec (no domain guard).

---

## STEP 3 — Expected vs actual (flagship) + failing stage

| | |
|---|---|
| **Expected** | Coimbatore engineering colleges, OC-cutoff ≤ 190, ranked: **1. Rathinam Technical Campus (179), 2. KIT (185.5), 3. SNS CoT (177.5)…** |
| **Actual** | **Coimbatore Institute of Engineering & Technology** (rank #227), confidence *high* |
| **Reason** | Stage 2 mis-parsed "Coimbatore" as a college → Stage 3 filtered the ranked list down to that one subject → Stages 5–10 faithfully explained the wrong college |
| **Failing stage** | **Stage 2 (entity extraction)** is the trigger; **Stages 3, 4, 6** are complicit (no district filter, no eligibility data, subject-collapse) |

---

## STEP 4 — Every architectural problem (code-level)

| ID | Problem | Root cause (file · line) |
|---|---|---|
| **RC1** | District/location mis-parsed as a **college** | [entity-extractor.ts:83-124](../../lib/ai/orchestration/query/entity-extractor.ts#L83-L124) `extractColleges` fuzzy-matches the whole query on every call; "coimbatore" matches "Coimbatore Institute…". No guard that the college's tokens actually appear; a `location` token is also matched as a college. |
| **RC1b** | Mis-parse collapses the list to 1 college | [ai-orchestrator.ts:198-199](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L198-L199) filters recs to `subjectIds` when any subject exists |
| **RC2** | District **never filters** | `RecommendationOptions` has **no district field** ([recommendation-engine.ts:37-42](../../lib/recommendation/facade/recommendation-engine.ts#L37-L42)); `location` is parsed then discarded in `runEngines` |
| **RC3** | Branch filtering weak | `availableBranches` weight 0.5 but **no branch data on profiles**; `recommendByBranch` can't filter → overall ranking → *"best CSE" = Bharathidasan University* |
| **RC4** | Eligibility/cutoff ignored | production injects **no cutoffs** → `nullCutoffLookup` ([recommendation-engine.ts:108](../../lib/recommendation/facade/recommendation-engine.ts#L108)) → every eligibility `unknown`; eligibility only **annotates**, never filters/re-ranks ([executor.ts:99-107](../../lib/recommendation/strategies/executor.ts#L99-L107)) |
| **RC5** | Confidence disconnected | confidence = **data-completeness** only ([config.ts:115](../../lib/recommendation/config.ts#L115)); ignores eligibility/branch/relevance → *high* on wrong answers |
| **RC6** | No domain routing | medical/arts/law/… not detected → engineering recs for out-of-domain queries |
| **RC7** | No unknown-entity guard | unknown college/branch/impossible combos still return a rec (fuzzy match floor too low) |
| **RC8** | Scores the whole warehouse | `rankProfiles` scores **all** `listProfiles()` then sorts; no filter-first ([executor.ts:90-95](../../lib/recommendation/strategies/executor.ts#L90-L95)) |
| **RC9** | 2026 data unused | `warehouse.nirf2026` (district, ocCutoff, powerScore) is present but not fed to `CollegeProfile`/scoring |

---

## STEP 5 — Correct pipeline (mapped to existing seams — **no redesign**)

```
Query → Intent → Entity → [Domain Router] → Eligibility → District → Community → Branch  (HARD FILTERS)
      → Candidate set → Scoring → Top-K → Evidence → LLM (explain only) → Response
```

Mapping to code (all seams already exist):
- **Domain Router** — new step in `intent-classifier`/`query-parser`: detect non-engineering domains → return a scope decline (Step 8). No new architecture.
- **Hard filters** — implemented via the existing **`RankSpec.accepts`** hook ([executor.ts:42](../../lib/recommendation/strategies/executor.ts#L42)), applied **before** scoring (fixes RC8). Filters: district, branch-availability, eligibility (cutoff), counselling type.
- **Eligibility** — inject a real **`CutoffLookup`** built from 2026 `ocCutoff` via the existing `createTableCutoffLookup` ([cutoff-lookup.ts:38](../../lib/recommendation/data/cutoff-lookup.ts#L38)); make ineligible colleges fail `accepts` (fixes RC4).
- **Scoring** — extend config weights + `CollegeProfile` with 2026 dimensions (fixes RC9).
- **LLM never chooses** — already true (the engine decides; the LLM only explains). This is preserved and hardened by Step 9.

**API preservation:** `RecommendationOptions`/`RecommendationRequest` gain an **optional** `district?: string` (additive). All existing method signatures stay. `createOpinionService`/`buildCounselorChatService` gain an optional cutoff source (additive; already plumbed as `options.cutoffs`).

---

## STEP 6 — Scoring algorithm (config-driven; no hardcoding)

Keep the existing weighted-sum scorer; **add dimensions** (all in `config.ts`, overridable):

| Dimension | Source | Role |
|---|---|---|
| placement, faculty, research, infrastructure, financialStrength, academicReputation, nirfPresence, dataCompleteness | existing warehouse | keep |
| **eligibilityFit** | cutoff vs student (via CutoffLookup) | prefer good-fit (safe but not wildly over-qualified) |
| **branchStrength** | branch data | rank by the asked branch, not overall |
| **powerScore** | 2026 `PowerScore` | composite quality |
| **careerOutcome** | 2026 `careerOutcome` | outcomes |
| **placementRate** | 2026 `avgPlacementPercentage` | distinct from salary |
| **scholarship** | 2026 `avgScholarshipPercentage` | affordability |

- **Weights** stay in `config.strategyWeights` per category (already the pattern). `district`, `branch`, `eligibility`, `community` are **hard filters**, not scores (see Step 7) — a college in the wrong district should be *excluded*, not down-weighted.
- Student **preference** = choosing a strategy weight profile (best_placement, best_roi, …), already supported.

---

## STEP 7 — Candidate filtering (filter-first)

Implement as `RankSpec.accepts` (runs **before** scoring, so we never score the whole warehouse — fixes RC8):

```
accepts(profile) =
     (district?   ? profile.district == district : true)
  && (branch?     ? profile.offersBranch(branch)  : true)
  && (eligible?   ? cutoffLookup(profile, community) is null OR <= studentCutoff : true)
  && counsellingTypeMatches
```
Then `scoring.score` only the survivors, sort, top-K. For `"CSE Coimbatore BC 190"`: eliminate non-Coimbatore, non-CSE, and OC-cutoff > 190 → **then** rank the rest → yields Rathinam/KIT/SNS…

---

## STEP 8 — Domain routing

Add a domain classifier (medical, dental, nursing, pharmacy, law, arts, science, agriculture, management, …). The warehouse is **TNEA engineering only**. On a non-engineering domain → **do not** run the engine; return the fixed scope message (*"I only have verified data for Tamil Nadu engineering admissions…"*). Never recommend an engineering college for a medical query.

---

## STEP 9 — Unknown / impossible

- Unknown **college** (fuzzy score below a raised threshold) → *"I don't have verified data on that college."*
- Unknown **branch** (not in the branch lexicon) → decline, don't answer for a different branch.
- **Impossible** combos (e.g. cutoff out of range, domain+cutoff mismatch) → decline.
- These are guards in the parser/orchestrator; the LLM still never invents (already enforced by the Sprint-5 guard).

---

## STEP 10 — Implementation roadmap (phased)

### Phase 1 — Stop the mis-parse (RC1) · *highest impact, lowest risk*
- **Files:** `query/entity-extractor.ts` (+ `patterns.ts`).
- **Change:** in `extractColleges`, (a) skip fragments already resolved as a `location`; (b) require ≥1 of the matched college's distinctive tokens to appear in the query (no prefix-only matches); (c) raise `COLLEGE_MATCH_THRESHOLD` for single-token matches.
- **Risk:** low (isolated; well-tested module). **Validation:** "CSE in Coimbatore…" and "colleges in Coimbatore" no longer yield a `college`; existing college-name tests still pass.
- **Expected:** flagship stops collapsing to CIET; district/branch queries reach the ranker.

### Phase 2 — Wire district as a hard filter (RC2)
- **Files:** `recommendation/models/request.ts` (+`district?`), `facade/recommendation-engine.ts` (forward it), `models/profile.ts` + `data/profile-provider.ts` (carry `district` from `warehouse.nirf2026.byCollege`), `strategies/strategies.ts` (add `accepts` district filter), `ai-orchestrator.ts` (pass `parsed.location`).
- **Risk:** medium (touches profile assembly). **Validation:** "colleges in Coimbatore" returns only Coimbatore colleges (verified vs 2026 `District`).

### Phase 3 — Wire eligibility (RC4)
- **Files:** new `data/nirf2026-cutoff-lookup.ts` (build `CutoffLookup` from 2026 `ocCutoff`, community OC) via `createTableCutoffLookup`; inject at `createOpinionService`/`buildCounselorChatService` (optional `cutoffs`, already plumbed); add eligibility to `accepts` (exclude ineligible).
- **Risk:** medium. **Validation:** "190 cutoff" excludes OC-cutoff > 190; bands populate; **note:** OC-only until community/branch cutoffs are sourced (surface the caveat).

### Phase 4 — Branch filter + strength (RC3)
- **Files:** branch data onto profiles (from `Ftnea_cutoffs` branch column / a branch dataset), `by_branch` `accepts` requires the branch, add `branchStrength` scoring.
- **Risk:** medium-high (needs branch data coverage). **Validation:** "best CSE" returns CSE-offering engineering colleges, not a general university.

### Phase 5 — Domain routing + unknown guards (RC6/RC7)
- **Files:** `query/patterns.ts` + `intent-classifier.ts` (domain detection), orchestrator decline path, raise fuzzy threshold.
- **Risk:** low-medium. **Validation:** medical/arts/law/unknown-college/impossible → decline (re-run the 108-query QA set).

### Phase 6 — Scoring dimensions + confidence (RC9/RC5)
- **Files:** `config.ts` (new dims+weights), `models/score.ts`, `scoring-engine.ts`, `profile-provider.ts` (2026 fields), confidence derivation from eligibility+branch+evidence.
- **Risk:** medium. **Validation:** ranking uses PowerScore/careerOutcome; confidence tracks answer quality.

### Phase 7 — Fix base-warehouse duplicate NIRF ids (from the prior validation)
- **Files:** `knowledge/transform/college-transform.ts` / `institutions.csv` handling (64 NIRF ids shared by 161 colleges) — else NIRF-based enrichment attaches to the wrong college.
- **Risk:** medium. **Validation:** distinct NIRF id per college; enrichment target correctness.

**Success criteria (from your brief) → covered by:** flagship correct → Ph1-3; district always correct → Ph2; branch → Ph4; eligibility → Ph3; community → Ph3 (+ future community cutoffs); no hallucination on unknowns → Ph5; GPT only explains → already true, hardened by Ph5.

---

**No code was modified. This is the plan for your approval before any implementation.**
Recommended order: **Phase 1 → 2 → 3** unblocks the flagship and the highest-volume failures; 4–7 complete correctness and production-hardening.
