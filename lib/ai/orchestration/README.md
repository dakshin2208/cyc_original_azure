# Sprint 4 — AI Orchestration Layer

The deterministic layer that prepares the exact, evidence-backed context a
**future** LLM will consume. It is **not** the chatbot and calls **no** model.

> The engines DECIDE (retrieve, score, rank, compare). The layer ORCHESTRATES
> and PACKAGES. The (future) LLM only EXPLAINS.
>
> No LLM · no embeddings · no vector DB · no chat interface · no streaming ·
> no OpenAI/Anthropic/Gemini SDK — verified by import + grep audit.

Placed at **`lib/ai/orchestration/`** — a new, self-contained subtree. The
pre-existing `lib/ai/query`, `lib/ai/shared`, `lib/ai/retrieval`, … modules were
left untouched (the instructions treat existing modules as immutable); this layer
only reuses the pure `Brand`/`SessionId` helpers from `@/lib/ai/shared` and the
deterministic Sprint 1–3 engines.

---

## 1. Files created (29 source, ~1,980 LOC · 11 test, ~815 LOC)

| Module | Files |
|--------|-------|
| **6 · DTOs** `models/` | enums · entities · query · evidence · context · prompt · response · conversation |
| Config | `config.ts` (evidence weights, confidence bands, source rank, prompt budgets) |
| **1 · Query Understanding** `query/` | patterns · normalizer · lexicon · entity-extractor · intent-classifier · query-parser |
| **4 · Evidence Collector** `evidence/` | evidence-collector |
| **3 · Context Builder** `context/` | context-builder |
| **5 · Prompt Builder** `prompt/` | business-rules · prompt-builder |
| **7 · Conversation State** `conversation/` | conversation-state |
| **2 · AI Orchestrator** `orchestrator/` | ai-orchestrator |
| Barrel | `index.ts` |

---

## 2. Directory tree

```
lib/ai/orchestration/
├── index.ts                       # public barrel
├── config.ts                      # weights / bands / budgets (nothing hardcoded downstream)
├── models/                        # Module 6 — DTOs only
│   ├── enums.ts entities.ts query.ts evidence.ts
│   ├── context.ts prompt.ts response.ts conversation.ts index.ts
├── query/                         # Module 1 — Query Understanding
│   ├── patterns.ts                #   intent/entity lexicons, typos, skip-tokens
│   ├── normalizer.ts              #   QuestionNormalizer
│   ├── lexicon.ts                 #   QueryLexicon (college resolver + locations, reuses retrieval)
│   ├── entity-extractor.ts        #   EntityExtractor
│   ├── intent-classifier.ts       #   IntentClassifier
│   └── query-parser.ts            #   QueryParser (composes the above)
├── evidence/evidence-collector.ts # Module 4 — dedupe · rank · confidence · source
├── context/context-builder.ts     # Module 3 — ContextPackage (no prompt text)
├── prompt/                        # Module 5
│   ├── business-rules.ts          #   system policy + anti-hallucination + output contract
│   └── prompt-builder.ts          #   PromptPackage (provider-agnostic messages)
├── conversation/conversation-state.ts  # Module 7 — session-scoped, immutable
├── orchestrator/ai-orchestrator.ts     # Module 2 — composition root + intent routing
└── __tests__/                     # Module 8 (11 files, 67 tests)
    ├── support.ts
    ├── normalizer · intent-classifier · entity-extractor · query-parser
    ├── evidence-collector · context-builder · prompt-builder
    ├── conversation-state · orchestrator
    └── production-data.smoke   (opt-in: CYC_DATA_DIR)
```

---

## 3. AI orchestration architecture

```
                       ┌──────────────────────────────────────────────┐
   User Question  ───▶ │  AIOrchestrator  (lib/ai/orchestration)       │
                       │                                               │
                       │  QueryParser ── normalize → extract → intent  │
                       │       │                                       │
                       │       ▼   route by intent (never the LLM)     │
                       │  ┌─────────────── deterministic engines ────┐ │
                       │  │ Recommendation · Comparison · Retrieval   │ │  ← Sprint 1–3
                       │  └─────────────────────┬─────────────────────┘ │    (reused, never modified)
                       │       ▼                                       │
                       │  EvidenceCollector  (dedupe · rank · confid.) │
                       │       ▼                                       │
                       │  ContextBuilder     (ContextPackage; gaps,    │
                       │                      follow-ups, confidence)  │
                       │       ▼                                       │
                       │  PromptBuilder      (system + rules + context │
                       │                      + evidence → PromptPackage)│
                       └───────────────────────┬───────────────────────┘
                                               ▼
                                    prompt.messages  ──▶  GPT / Claude / Gemini   (Sprint 5+, NOT here)
                                               ▼
                                    AIResponse (DTO defined, produced later by the LLM only)
```

**Invariants (all enforced + tested)**

- **The LLM never** retrieves, calculates, ranks, or compares — those are the
  engines'. This layer forbids it structurally: it hands over finished results.
- **Deterministic** — no `Date`/`Math.random`; pure keyword/regex/lookup parsing
  and engine calls. Byte-identical prompts across identical runs (verified on the
  real 324-college warehouse).
- **No hallucination path** — the prompt embeds an absolute anti-invention policy,
  serializes ONLY supplied evidence with citable ids, and renders every missing
  value as `UNAVAILABLE`.
- **No `any`**, fully typed, `readonly` DTOs; nothing hardcoded downstream of
  `config.ts`; every collaborator is constructor-injected (DI).

---

## 4. Query processing flow

```
orchestrate("Compare PSG College of Technology and Anna University")
  │
  ├─ QueryParser.parse
  │     normalize  → "compare psg college of technology and anna university"
  │     extract    → colleges=[PSG, Anna]  (comparison split + fuzzy resolve)
  │     classify   → intent=compare_colleges (two colleges ⇒ boost), confidence 1.0
  │
  ├─ route(compare_colleges) → reco.compareColleges([PSG, Anna])   ← Comparison Engine
  │                          + factsFor(each subject)              ← Retrieval summaries
  │
  ├─ EvidenceCollector.collect → 17 items, deduped, ranked, sourced, confidence-banded
  │
  ├─ ContextBuilder.build      → ContextPackage {intent, subjects, comparison,
  │                              facts, evidence, confidence, missing, follow-ups, notes}
  │
  └─ PromptBuilder.build       → PromptPackage {system, context, formatting, user, messages}
```

**12 supported intents:** recommend_college · compare_colleges · branch_advice ·
placement_query · research_query · faculty_query · roi_query · nirf_query ·
cutoff_query · eligibility_query · general_information · unknown.

**11 entity types:** college · branch · cutoff · community · category · score ·
nirf_rank · fees · placements · scholarship · location (numbers are classified by
keyword context; colleges via the Sprint 2 fuzzy matcher; misspellings corrected).

---

## 5. Context object example (real output, compare query)

```jsonc
{
  "intent": "compare_colleges",
  "intentConfidence": 1,
  "subjects": ["PSG College of Technology", "Anna University"],
  "recommendationCount": 0,
  "comparisonWinner": "PSG College of Technology",
  "evidence": [
    { "id": "retrieval-anna-university-placement-median-salary-inr-yr-850000",
      "college": "Anna University", "label": "Median salary (INR/yr)",
      "value": 850000, "source": "retrieval", "confidence": "high" }
    // … 17 ranked, deduped, sourced items total
  ],
  "evidenceCount": 17,
  "confidence": { "overall": 1, "level": "high", "evidenceCompleteness": 1 },
  "missingInformation": [],      // e.g. {field:"cutoff_dataset", severity:"degraded", …} for eligibility
  "followUpQuestions": [],       // e.g. "What is your cutoff mark (out of 200)?"
  "notes": []                    // e.g. ROI/fees caveats carried from the engine
}
```

> The Context Package contains **no prompt text** (asserted by a test) — that is
> exclusively the Prompt Builder's job.

---

## 6. Prompt package example (real output)

**System** (excerpt) — the anti-hallucination policy:

```
You are a college-counselling EXPLAINER. A separate deterministic engine has already
retrieved the data, scored the colleges, ranked the recommendations, and computed any
comparison. Your ONLY job is to explain those results …

ABSOLUTE RULES (never violate):
- Use ONLY the EVIDENCE and FACTS supplied below. Treat them as the sole source of truth.
- Never invent or guess a college. …
- Never invent or guess a cutoff, rank, placement figure, salary, fee, or any number.
- Never re-rank, re-score, or re-compute. …
- If a value is missing or marked unavailable, explicitly say it is unavailable …
- Attach a citation (the evidence id) to every factual claim you make.
```

**Context** (excerpt) — finished results + citable evidence:

```
INTENT: compare_colleges (confidence 1.00)
SUBJECT COLLEGES: PSG College of Technology, Anna University
COMPARISON (already computed):
  Overall winner: PSG College of Technology
  Per-dimension winners: placement→PSG…, faculty→PSG…, research→PSG…
RETRIEVED FACTS:
  - Anna University | Median salary (INR/yr) = 850000 (placement)
  - PSG College of Technology | Closing cutoff = UNAVAILABLE (cutoff)   ← never invented
EVIDENCE (cite these ids):
  [retrieval-anna-university-placement-median-salary-inr-yr-850000] Anna University | … = 850000 (confidence: high)
```

**Messages / metadata:** `messages = [system, user]` (neutral roles for any
provider); `metadata = {intent, evidenceCount:17, subjectCount:2,
hasComparison:true, approxChars:5749}`. A `FORMATTING_RULES` block declares the
required JSON output contract (mirrors the `AIResponse` DTO).

---

## 7. Validation report

| Gate | Command | Result |
|------|---------|--------|
| TypeScript (app, `strictNullChecks`) | `tsc --noEmit --incremental false` | **0 errors** in `lib/ai/orchestration` |
| TypeScript (tests) | `tsc -p tsconfig.test.json` | **0 errors** |
| `any` detection | grep (source) | **0** |
| Forbidden imports (LLM/vector/embeddings/streaming SDKs) | grep | **0** |
| Circular dependencies | `madge --circular` (orchestration + all deps, alias-resolved) | **none** (180 files) |
| Full test run | `vitest run` | **285 passed / 6 skipped** (hermetic) |
| Full test run + real warehouse | `CYC_DATA_DIR=… vitest run` | **291 passed / 0 skipped** |
| Real warehouse build | `buildWarehouseFromDirectory` | **324 colleges** |
| Every supported intent → valid Context+Prompt | real-data smoke | **12/12**, deterministic ✓ |
| Dependency boundary | import audit | only `@/lib/{knowledge,retrieval,recommendation}` + `@/lib/ai/shared` |

---

## 8. Test summary (63 unit + 4 real-warehouse smoke = 67)

- `normalizer` (6) — casing, `&`/`/`/decimals, punctuation, typo map, empty
- `intent-classifier` (7) — every intent, entity boosts, unknown, confidence, determinism
- `entity-extractor` (11) — number classification, community (weak-code gating),
  branch canonicalization, category, location, distinctive-token college gate,
  misspellings, multi-college
- `query-parser` (6) — full ParsedQuery per intent, misspellings, unknown, determinism
- `evidence-collector` (5) — collect/rank/confidence, unique ids + dedupe,
  value-before-unavailable, comparison winners, determinism
- `context-builder` (6) — **no prompt text**, blocking gaps + follow-ups,
  cutoff/fees unavailability, subjects+comparison, unknown low-confidence
- `prompt-builder` (6) — anti-hallucination policy present, message roles,
  evidence-id serialization, `UNAVAILABLE` rendering, metadata, determinism
- `conversation-state` (5) — empty start, immutable multi-turn accumulation,
  recommendations/clarifications/branches, orchestrator-advanced state
- `orchestrator` (11) — routing per intent, government filter, best-placement,
  named-college facts, comparison, ROI caveat, blocked eligibility, garbage input,
  **no invented data**, determinism, standalone `parse()`
- `production-data.smoke` (4, opt-in) — 12/12 intents on 324 real colleges,
  no invented colleges, byte-identical prompts, sample prompt dump

---

## 9. Production readiness assessment

**Ready** as a deterministic, LLM-agnostic orchestration layer. It is fully typed
(no `any`), acyclic, deterministic, config-driven, DI-based, and verified against
real production data. It safely degrades on every gap (missing cutoff/fees/branch
data, unresolved colleges, garbage input) — surfacing `missingInformation` +
`followUpQuestions` rather than fabricating — and never throws (engine calls are
wrapped; failures become notes). The prompt is provider-agnostic: `prompt.messages`
plugs into GPT, Claude, or Gemini unchanged.

**Known limitations (all inherited data gaps, surfaced transparently):**
- Eligibility/cutoff answers report `UNAVAILABLE` until a cutoff dataset is wired
  (the Recommendation Engine already accepts an injectable `CutoffLookup`).
- Fees/scholarship are not in the dataset → flagged, never guessed.
- College acronyms (e.g. "SSN") that aren't name substrings may not resolve.
- Intent scoring is heuristic (keyword + entity boosts); ambiguous phrasings pick
  the highest-priority match and expose confidence for the caller to gate on.

---

## 10. Remaining work before integrating an LLM (Sprint 5+)

1. **LLM adapter behind a port** — implement a provider adapter (`llm.port` already
   exists in `@/lib/ai/shared`) that accepts `PromptPackage.messages` and returns
   the `AIResponse` DTO. Keep it swappable (GPT/Claude/Gemini).
2. **Response validation** — verify every citation `evidenceId` the model returns
   exists in the `EvidencePackage`; reject/repair answers that cite unknown ids or
   assert uncited facts (the contract is already in the prompt).
3. **Wire a real `CutoffLookup`** to activate Dream/Reach/Target/Safe eligibility.
4. **Streaming / transport** (optional) — a delivery concern for the API layer, not
   this deterministic core.
5. **Telemetry** — record intent, evidence counts, confidence, and follow-up rates
   (adapters exist under `@/lib/ai/adapters`).
6. **Session store** (optional) — the conversation state is intentionally
   request/session-scoped; persistence, if ever wanted, is a separate concern.

**The output of Sprint 4 is a fully deterministic orchestration layer that can be
connected to GPT, Claude, or Gemini with minimal changes — no LLM is integrated
yet, by design.**
