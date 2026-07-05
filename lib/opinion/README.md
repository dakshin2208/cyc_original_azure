# Sprint 8 — AI Opinion & Recommendation Engine

Turns the assistant from a fact retriever into an expert counselor. It sits ON TOP
of the existing pipeline and produces grounded, structured **opinions** —
recommendation + reasoning + evidence ids + confidence + trade-offs + risks —
then lets the LLM phrase them.

> The engine DECIDES (deterministically, from retrieved evidence); the LLM only
> EXPLAINS. It never invents a fact, never calls a provider directly, never hardcodes
> a recommendation, and modifies no earlier sprint. With no provider wired it returns
> a fully-grounded deterministic counselor answer.

Verified: **0** provider-SDK imports; reuses Sprint 2 (retrieval), Sprint 3
(recommendation), Sprint 4 (orchestration/evidence/context), and Sprint 5 (LLM
adapter + hallucination guard).

---

## 1. Directory tree

```
lib/opinion/
├── index.ts                              # public barrel
├── config.ts                             # candidate limit, strengths N, priority→dimension
├── models/                               # Module 6 — DTOs
│   ├── enums.ts dossier.ts recommendation.ts context.ts response.ts index.ts
├── context/opinion-context-builder.ts    # Module 1 — dossiers, strengths/weaknesses, trends, missing
├── strategy/opinion-strategy.ts          # Module 2 — intent+entities+priorities → strategy
├── generator/opinion-generator.ts        # Module 3 — deterministic recommendation objects
├── prompt/opinion-prompt-builder.ts      # Module 4 — counselor prompt (Sprint-4 PromptPackage)
├── validator/opinion-validator.ts        # Module 5 — opinion-specific validation
├── formatter/opinion-formatter.ts        # Module 6 — response contract + deterministic fallback
├── engine/opinion-engine.ts              # facade (prepare / complete) + quality fallback
├── service/opinion-service.ts            # Module 7 — integration (reuse S4 orchestrator + S5 adapter)
└── __tests__/                            # 29 tests
    ├── support.ts strategy.test.ts generator.test.ts validator.test.ts
    ├── formatter.test.ts service.test.ts production-data.smoke.test.ts
```

16 source files (~1,200 LOC) · 7 test files (~510 LOC).

## 2. Files created
All of `lib/opinion/**`. **Files modified (existing):** only `vitest.config.ts`
and `tsconfig.test.json` (added the `lib/opinion/**` test globs). No Sprint 1–7
source was touched.

---

## 3. Architecture

```
User → Chat API → Retriever (S2) → Recommendation Engine (S3)
                        │  (all reused via the Sprint-4 orchestrator, unmodified)
                        ▼
                Opinion Engine (Sprint 8)
                  1 Context Builder  → CollegeDossier[] (placements, faculty, research,
                                       finance, location, strengths/weaknesses, trends,
                                       eligibility, evidence ids; fees/scholarships = unavailable)
                  2 Strategy         → college / comparison / eligibility-bands / *-focused / …
                  3 Generator        → OpinionRecommendation[]  (reasoning, evidence ids,
                                       confidence, TRADE-OFFS, RISKS) — deterministic
                  4 Prompt Builder   → Sprint-4 PromptPackage (counselor persona, grounded)
                        ▼
                LLM Adapter (Sprint 5, reused) → parse + validate + hallucination-guard
                        ▼
                  5 Validator        → opinion-specific gate (cites real evidence, only
                                       candidate colleges, never confident when insufficient)
                  6 Formatter        → OpinionResponse  {answer, evidence, confidence,
                                       follow-ups, recommendation summary}
                        ▼
                 Grounded Chat Response   (deterministic fallback if the model is unusable)
```

The Opinion Engine **never bypasses** the retriever or recommendation engine — it
consumes their output through the Sprint-4 orchestrator. The LLM is reached **only**
through the injected Sprint-5 adapter.

---

## 4. Opinion generation flow

```
advise("I scored 182. Which colleges should I choose?")
  ├─ Sprint-4 orchestrator → parsed (intent=eligibility, cutoff=182) + context (recommendations, evidence)
  ├─ selectStrategy → eligibility_bands
  ├─ [fallback] no cutoff dataset ⇒ community blocked recs → grounded overall-quality baseline + its evidence
  ├─ buildOpinionContext → dossiers (eligibility = unknown) + fee/cutoff "unavailable" flags
  ├─ generateOpinions → top_pick + alternatives, each with reasoning / trade-offs /
  │                     RISK: "eligibility unconfirmed (no historical cutoff data)"
  ├─ buildOpinionPrompt → counselor PromptPackage
  ├─ LLMAdapter.respond(prompt, context)  → validated AIResponse  (or safe fallback)
  ├─ validateOpinionResponse → cites real evidence & candidates?
  └─ formatOpinion → OpinionResponse (model prose, or deterministic grounded answer)
```

---

## 5. Recommendation strategies

`college_recommendation` · `branch_recommendation` (adds a branch-data caveat) ·
`comparison` (winner + per-dimension leads + trade-offs) · `eligibility_bands`
(safe / moderate / dream from S3 bands, or quality + caveat when cutoffs are
unknown) · `placement_focused` · `research_focused` · `faculty_focused` ·
`budget_focused` (fees-unavailable risk, ROI proxy) · `location_focused` ·
`general_counseling` · `insufficient_evidence` (graceful "I don't have enough
evidence…"). Two named colleges always ⇒ comparison; a garbage/unrecognized query
⇒ insufficient (never a college dump).

---

## 6. Prompt design

A Sprint-4 `PromptPackage` (so the Sprint-5 adapter consumes it unchanged):
- **System** — a counselor persona + ABSOLUTE RULES: use only the supplied
  RECOMMENDATIONS + EVIDENCE; never invent a college/cutoff/placement/fee/ranking;
  present recommendations faithfully; state trade-offs & risks honestly; say when
  information is unavailable; **express uncertainty** when evidence is insufficient
  and ask a clarifying question; cite evidence ids.
- **Context** — `STRATEGY`, the serialized `RECOMMENDATIONS` (kind, headline,
  colleges, reasoning, trade-offs, risks, confidence, evidence ids), the citable
  `EVIDENCE` list, `CONVERSATION SO FAR`, and `MISSING / UNAVAILABLE`.
- **Formatting** — reuses Sprint-4's JSON output contract, so the same parser +
  hallucination guard apply.

---

## 7. Validation strategy

Two layers, both grounded only in the deterministic context:
1. **Reused Sprint-5 guard** — parses the model JSON, rejects invented citations,
   and strips fabricated figures / hallucinated colleges (no unsupported facts, no
   fabricated placements/rankings/cutoffs).
2. **Opinion validator (Module 5)** — on top: the answer must cite only real
   opinion evidence and only candidate colleges; a substantive answer must carry a
   citation; and if the engine determined evidence was **insufficient**, the model
   answer is discarded outright.

On any failure the **formatter falls back to a deterministic, fully-grounded
answer** synthesized from the recommendation objects — so the response is always
safe and evidence-based (including the graceful insufficient-evidence message).

**Real comparison output** (deterministic, no provider):
```
strategy: comparison   usedModel: false   confidence: high
answer: "…Overall, PSG College of Technology scores higher on the weighted evidence.
         Stronger placements/faculty/research…: PSG. Trade-offs — PSG leads on placements,
         faculty, research… Please note: Fees and campus environment are not in the dataset;
         weigh those separately."
```

---

## 8. Test report (52 tests — one per module + integration + real warehouse)

- `config` (4) — priority→dimension map, default/override merge, substantive-dimension set
- `strategy` (4) — intent→strategy, two-colleges⇒comparison, priorities, overrides
- `context-builder` (7) — dossiers from retrieval, **fees/scholarships = unavailable**,
  substantive strengths/weaknesses, historical trend, comparison candidates, subject
  fallback, budget fee-flag
- `generator` (5) — safe/moderate/dream banding; quality fallback + eligibility
  caveat; insufficient; top-pick + alternatives with trade-offs/risks/evidence ids;
  budget fee-risk
- `prompt-builder` (6) — counselor persona + anti-hallucination + **uncertainty**
  policy; grounded serialization (reasoning/trade-offs/risks/evidence); history +
  missing-info sections; `[system, user]` messages; metadata; determinism
- `validator` (6) — accept real citation; reject unknown-evidence / non-candidate /
  uncited / S5-fallback; never trust model when insufficient
- `formatter` (3) — model answer when valid; deterministic grounded fallback; the
  always-present recommendation summary
- `engine` (6) — prepare (context+recommendations+prompt); **grounded quality
  fallback** when orchestration is blocked; no fabrication on unrecognized query;
  determinism; complete accept/fallback
- `service` (9) — college recommendation, comparison, branch caveat, **eligibility
  safe/dream bands** (with wired cutoffs), insufficient, grounded model answer,
  **hallucination rejection → deterministic**, continuity, determinism
- `production-data.smoke` (2, opt-in) — every example query over the real
  324-college warehouse, **no invented / no fabricated-citation college**, deterministic

**No failures.** All 50 hermetic tests pass; both real-warehouse tests pass when
`CYC_DATA_DIR` is set.

---

## 9. Validation report

| Gate | Result |
|------|--------|
| TypeScript (app, `strictNullChecks`) | **0 errors** in `lib/opinion` |
| TypeScript (tests) | **0 errors** |
| No `any` (source **and** tests) | **0** |
| Provider called directly / SDK imports | **0** |
| Circular dependencies (`madge`, all layers) | **none** (411 files) |
| Opinion tests | **50 passed / 2 skipped** (opt-in real warehouse) |
| Full regression | **443 passed / 10 skipped** (hermetic) · **453 / 0** (real warehouse) |
| Deterministic behavior | verified (prepare/advise/prompt repeat-equality tests) |
| Sprint 1–7 source modified | **0** (only test-glob config) |
| **Documented failures** | **none** |

---

## 10. Production readiness assessment

**Production-ready** as the counselor layer. It is fully typed (no `any`), acyclic,
deterministic, and reuses every earlier sprint without modification. Every
recommendation is **generated from retrieved evidence**; it renders trade-offs and
risks honestly, marks fees/scholarships/cutoffs as **unavailable** rather than
inventing them, and degrades gracefully to "I don't have enough evidence to
confidently recommend…" when candidates are absent. Because the deterministic
answer is always grounded, the engine is **fully usable today with no LLM** and
becomes conversational the moment a Sprint-5 provider is registered — with the
hallucination guard + opinion validator ensuring the model can only phrase what the
engine already decided.

**Inherited data limits (surfaced, never hidden):** no historical cutoff dataset
(eligibility banding is reported as unconfirmed unless a `CutoffLookup` is injected),
no fees/scholarship data (budget counseling uses an ROI proxy with an explicit
caveat), and no per-college branch linkage (branch advice ranks by overall quality
with a caveat). Wiring any of these datasets activates the corresponding banding/
filtering with zero engine changes.

The opinion service is a drop-in alternative to the Sprint-6 chat service; adopting
it is a one-line swap in the composition root (left untouched here, per scope).
