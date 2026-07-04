# AI Counselor — Improvement Roadmap (v2)

**Status:** production rolled back on 2026-07-04. The AI Counselor is functional
but **not production-ready**. Production was restored to the last stable release
**`e8a0e44a` "Dashboard Done v2"** (pre-AI). All AI work continues **only** on
`feature/ai-counselor-v2` until the release gate (§14) is green.

> Nothing is deleted. The full AI stack lives on this branch and in git history:
> AI chat system, retrieval pipeline, Opinion Engine, Azure OpenAI integration,
> tests, knowledge warehouse, prompt templates, and the Docker improvements.

---

## 1. Why we rolled back

Observed / reported problems on the deployed AI Counselor:

- **Low confidence on common questions.** A plain *"What is the best college for
  CSE?"* returns `confidence: "medium"` and hedged prose.
- **Branch reasoning is not real.** Same query is classified `branch_recommendation`
  but the answer says *"Branch-level data is unavailable; ranked by overall college
  quality"* — it silently degrades to an overall-quality ranking instead of a
  CSE-specific one (it recommended *Bharathidasan University*, a general university,
  for CSE).
- **Eligibility / cutoff reasoning incomplete.** Answers include *"Eligibility is
  unconfirmed (no historical cutoff data)"* even for mainstream queries.
- **Medical college queries** are out of scope of the warehouse (TNEA engineering
  data) yet are not detected and refused cleanly.
- **Recommendation quality is inconsistent** across phrasings of the same intent.

These are quality/coverage problems, not wiring problems — the pipeline itself
(retrieval → recommendation → evidence → Azure OpenAI → grounded answer) works and
is verified. The gaps are in **data coverage, ranking, confidence, and prompting**.

---

## 2. Current architecture (unchanged target)

```
User → Chat UI → POST /api/chat
   → Warehouse Retrieval (CSV, deterministic)      lib/knowledge, lib/retrieval
   → Recommendation Engine (deterministic ranking) lib/recommendation
   → Evidence Bundle + prompt                       lib/opinion (engine/prompt)
   → Azure OpenAI GPT-4.1 (reasoning ONLY)          lib/ai/llm/providers/openai
   → Grounded Answer (deterministic fallback)       lib/opinion/formatter → 200
```

The warehouse stays the single source of truth; the LLM never invents facts. v2
improves the **quality** of each stage, not the shape.

---

## 3. Better retrieval
**Problem:** retrieval returns overall-college evidence even for branch/eligibility
intents, so downstream reasoning has nothing branch-specific to work with.
**Where:** `lib/retrieval/*`, `lib/ai/orchestration` (evidence collector).
**Do:**
- Branch/program-aware retrieval (join college × branch × cutoff), not just college-level.
- Retrieve the *right* evidence per intent (placement, research, faculty, fees) instead of a generic bundle.
- Rank/trim evidence by relevance to the parsed query (cutoff band, community, branch), not just recency/among-all.
**Done when:** for a branch query, ≥1 branch-level evidence row is retrieved for each recommended college (or the query is explicitly marked out-of-coverage).

## 4. Better recommendation ranking
**Problem:** ranking falls back to "overall college quality" too readily, producing
implausible picks for specific intents.
**Where:** `lib/recommendation/*`, `lib/opinion/generator`, `lib/opinion/engine` (`RECOMMEND_FALLBACK`).
**Do:**
- Intent-specific scoring (CSE placement ≠ overall NIRF).
- Down-rank / flag general universities when the user asks for an engineering branch.
- Make the "overall-quality fallback" explicit and rare, with a visible caveat and lowered confidence — not the default.
**Done when:** top-3 for "best CSE college" are engineering colleges strong in CSE, reproducibly, across phrasings.

## 5. Medical college support (or clean refusal)
**Problem:** the warehouse is TNEA **engineering**; medical queries are neither
answered nor cleanly declined.
**Where:** query parsing / intent detection (`lib/ai/orchestration`), system prompt.
**Do (pick one for v2):**
- **Scope guard (minimum):** detect medical/other out-of-domain intent and return a clear "I only cover Tamil Nadu engineering admissions" message (not a hedged engineering answer).
- **Coverage (stretch):** add a medical warehouse (separate source files + schema) if in scope.
**Done when:** medical queries get a deterministic, correct scope response; no engineering colleges are suggested for medical questions.

## 6. Engineering branch reasoning
**Problem:** branch intent is detected but branch data isn't used.
**Where:** `lib/recommendation` (branch model), warehouse branch/cutoff tables.
**Do:** model branch-level cutoffs, intake, and (where available) branch placement; reason at the branch level; state clearly when branch data is missing for a specific college rather than blanket-disclaiming.
**Done when:** branch answers cite branch-level rows and stop emitting "branch-level data is unavailable" for colleges where it *is* available.

## 7. Cutoff prediction improvements
**Problem:** "eligibility unconfirmed / no historical cutoff data" appears too often.
**Where:** `lib/recommendation/data/cutoff-lookup.ts`, `Ftnea_cutoffs.csv`, banding logic.
**Do:**
- Improve cutoff coverage + fuzzy matching (college/branch/community/year).
- Predict/interpolate cutoffs where safe (trend across years) with an explicit confidence tag — never fabricate.
- Correctly band safe / moderate / ambitious against the student's cutoff.
**Done when:** for colleges with cutoff rows, eligibility is computed (not disclaimed); predictions are labeled as predictions.

## 8. Community-aware reasoning
**Problem:** community (OC/BC/MBC/SC/ST…) strongly affects TNEA cutoffs but is
under-used.
**Where:** query parsing (community extraction), cutoff lookup, banding.
**Do:** parse community reliably; use community-specific cutoff columns; personalize eligibility and safe/moderate/ambitious bands to the student's community.
**Done when:** the same cutoff yields different, correct eligibility per community.

## 9. Better confidence scoring
**Problem:** confidence is coarse and defaults to "medium"; it doesn't reflect
evidence strength.
**Where:** `lib/opinion/formatter`, `lib/opinion/validator`, confidence derivation.
**Do:** derive confidence from concrete signals — evidence count/coverage, cutoff availability, community match, branch-data presence, and whether the model or the deterministic fallback answered. High only when eligibility + branch + placement evidence all align.
**Done when:** confidence correlates with evidence completeness and is stable across phrasings.

## 10. Multi-step planning
**Problem:** single-shot reasoning can't handle compound asks ("compare X and Y for
CSE for my cutoff and community and budget").
**Where:** `lib/opinion/service`, orchestration.
**Do:** decompose complex queries (retrieve → filter by eligibility → rank by intent → compare → summarize) as explicit deterministic steps; keep the LLM as the final explainer over the assembled evidence.
**Done when:** multi-constraint queries return a structured, correct comparison grounded in evidence for each constraint.

## 11. Prompt improvements
**Problem:** prompts under-specify how to handle missing data, branch specifics, and
confidence, yielding hedged output.
**Where:** `lib/ai/llm/prompts/tn-counselor-system.ts`, `lib/opinion/prompt/opinion-prompt-builder.ts`.
**Do:** sharpen the counselor persona and rules; instruct precise handling of partial evidence (state what's known vs unknown per college, don't blanket-disclaim); few-shot exemplars for recommendation/comparison/eligibility; enforce citation-per-claim.
**Done when:** prompt-only changes measurably raise answer specificity + confidence on the eval set (§13) without new hallucinations.

## 12. Hallucination reduction
**Problem:** must guarantee zero invented colleges/cutoffs/figures as coverage grows.
**Where:** `lib/ai/llm/adapter.ts` (guard), `lib/opinion/validator`.
**Do:** keep + extend the citation/entity guard; add numeric-claim validation (every number traces to an evidence row); expand adversarial tests for fabricated colleges/cutoffs/salaries.
**Done when:** the hallucination test suite covers colleges, cutoffs, salaries, placement %, and rankings, and all pass; guard-removed rate is tracked.

## 13. More warehouse coverage
**Problem:** gaps in cutoffs, branch tables, and (if in scope) medical data drive the
disclaimers above.
**Where:** `CYC_DATA_DIR` CSVs, `lib/knowledge/warehouse`.
**Do:** ingest fuller cutoff history (multi-year, all communities), branch-level intake/placement, and validate on ingest; document coverage per source; grow `SOURCE_FILES` deliberately.
**Done when:** a coverage report shows the % of colleges with branch + cutoff + placement data, and it clears an agreed threshold.

## 14. Better fallback responses
**Problem:** the deterministic fallback answer is generic ("ranked by overall college
quality").
**Where:** `lib/opinion/formatter` (`deterministicAnswer`), follow-ups.
**Do:** make fallbacks intent-specific and helpful (what's missing, what to provide — "tell me your community and cutoff"); keep them grounded and clearly labeled; ensure they never look like a confident branch recommendation.
**Done when:** fallbacks are useful, honest, and distinguishable from full answers.

---

## 15. Production evaluation checklist (release gate)

An **evaluation set** of representative queries with expected properties must exist
(`docs/AI/eval/` or a test suite) covering: recommendation, comparison, eligibility,
branch, community, budget, out-of-domain (medical), and adversarial/hallucination.

Ship v2 to production **only when all** of the following hold:

- [ ] Eval set defined (≥ ~50 queries) with expected intent + evidence + confidence.
- [ ] Recommendation quality: top-3 are plausible & reproducible across phrasings.
- [ ] Branch queries use branch-level evidence (no blanket "branch data unavailable").
- [ ] Eligibility computed for colleges with cutoff data; predictions labeled.
- [ ] Community-aware eligibility verified for OC/BC/MBC/SC/ST.
- [ ] Confidence correlates with evidence completeness; not defaulting to "medium".
- [ ] Medical / out-of-domain queries get a clean scope response (no eng. suggestions).
- [ ] Hallucination suite (colleges, cutoffs, salaries, placement %, rankings) passes.
- [ ] Fallbacks are intent-specific, honest, and clearly labeled.
- [ ] Full regression green (`npm test`), TypeScript clean, `next build` clean.
- [ ] Docker image builds and boots with warehouse at `/app/data`; `/api/chat` 200.
- [ ] **Live smoke test on a staging revision shows `llmStatus:"model"`** (real GPT-4.1,
      not deterministic) for the eval queries, with correct citations.
- [ ] Azure OpenAI configured: `OPENAI_API_KEY` (rotated), `AZURE_OPENAI_ENDPOINT`,
      `OPENAI_API_VERSION`, `OPENAI_MODEL=gpt-4.1` set on the Container App.
- [ ] Latency + cost within budget under expected load.
- [ ] Rollback path documented (how to disable `/api/chat` or revert quickly).

---

## 16. Working agreement

- All AI changes land on `feature/ai-counselor-v2` (or PRs into it), never directly on `main`.
- `main` stays at the stable, non-AI release until §15 is fully green.
- Re-releasing merges this branch back into `main`; note that `main` currently
  contains a **revert of the AI merge**, so bringing v2 back will require reverting
  that revert (or rebasing v2) — plan the re-merge accordingly.
- Rotate the previously-exposed Azure key before any further live testing.
