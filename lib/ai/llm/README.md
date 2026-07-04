# Sprint 5 — LLM Integration Layer

Provider-agnostic layer that turns a Sprint 4 `PromptPackage` + `ContextPackage`
into a **validated, hallucination-guarded** `AIResponse` — behind a swappable
provider interface.

> No provider SDK · no network call · no streaming · no UI · no Next.js routes.
> The engines DECIDED (Sprint 1–3), Sprint 4 PACKAGED, a provider GENERATES, and
> **this layer parses, validates, and guards** — verified by import + grep audit.

```
User Question → AI Orchestrator (S4) → PromptPackage → LLM Adapter (S5)
             → parse → validate → hallucination-guard → Final Chat Response (LLMResult)
```

The adapter never lets the model invent: it rejects invented citations, strips
unsupported factual sentences, retries once, and otherwise returns a deterministic
fallback built from the context. It never throws.

---

## 1. Files created (9 source, ~850 LOC · 8 test, ~540 LOC)

| File | Responsibility |
|------|----------------|
| `provider.ts` | `LLMProvider` interface + function/static/unavailable providers (the DI seam a real SDK fills) |
| `message.ts` | `CompletionRequest`/`CompletionResult` boundary DTOs + `toCompletionRequest(prompt)` |
| `parser.ts` | raw completion (fences/prose tolerant) → `AIResponse`, type-guarded coercion |
| `validator.ts` | `buildGrounding` + `validateResponse` (hard reject) + `applyHallucinationGuard` (soft repair) |
| `response.ts` | `LLMResult` / `LLMResponseStatus` / `ResponseIssue` DTOs |
| `adapter.ts` | the pipeline: provider → parse → validate → guard → retry → deterministic fallback |
| `factory.ts` | `ProviderRegistry` (swappable, no hardcoded provider) + adapter construction |
| `errors.ts` | `LLMError` · `ProviderError` · `ParseError` · `UnknownProviderError` |
| `index.ts` | public barrel |

---

## 2. Directory tree

```
lib/ai/llm/
├── index.ts
├── errors.ts
├── message.ts        # provider-boundary request/result
├── provider.ts       # LLMProvider interface + generic providers (no SDK)
├── response.ts       # LLMResult + status + issues
├── parser.ts         # raw JSON → AIResponse
├── validator.ts      # grounding + structural validation + hallucination guard
├── adapter.ts        # PromptPackage+Context → safe LLMResult (retry + fallback)
├── factory.ts        # ProviderRegistry + createAdapterFor
└── __tests__/        # 46 tests
    ├── support.ts    # reuses the S4 orchestrator for real prompt/context
    ├── provider.test.ts   parser.test.ts   validator.test.ts
    ├── guard.test.ts      adapter.test.ts  factory.test.ts
    └── integration.test.ts
```

---

## 3. Architecture

```
                          createLLMAdapter(provider, config?)
                                     │
 PromptPackage + ContextPackage ─────┤
   (from @/lib/ai/orchestration)     ▼
                          ┌───────────────────────────────────────────┐
                          │  adapter.respond()                          │
                          │   1. buildGrounding(context)                │  ← evidence ids,
                          │        (evidence ids, known colleges,       │    known colleges,
                          │         allowed numbers)                    │    allowed figures
                          │   2. provider.complete(request) ──────────┐ │
                          │        (LLMProvider — swappable seam)      │ │
                          │   3. parseAIResponse(text)                 │ │  retry once on
                          │   4. validateResponse  → reject?  ─────────┤ │  parse/validate/
                          │   5. applyHallucinationGuard → repair      │ │  provider failure
                          │   6. else deterministic fallback ──────────┘ │
                          └───────────────────────────────────────────┘
                                     ▼
                            LLMResult  { status, response: AIResponse,
                                         issues, attempts, raw, provider }
```

**Dependency boundary:** the layer imports ONLY `@/lib/ai/orchestration` (the
Sprint 4 barrel) — no SDK, no vector/embedding library, nothing else.

---

## 4. Provider abstraction (swappable, nothing hardcoded)

```ts
export interface LLMProvider {
  readonly name: string
  complete(request: CompletionRequest): Promise<CompletionResult>
}
```

A provider is a **thin transport** — no parsing, no validation, no business logic.
This sprint ships only generic providers (`createFunctionProvider`,
`createStaticProvider`, `createUnavailableProvider`) — the seam a real SDK wrapper
fills. Adding OpenAI / Claude / Gemini later is one file each, with **zero** changes
to the adapter/validator/parser:

```ts
// Sprint 6+ (illustrative — NOT built here, no SDK imported):
const openai = createFunctionProvider('openai', async (req) => {
  const res = await client.chat.completions.create({ messages: req.messages, ... })
  return { text: res.choices[0].message.content ?? '', model: res.model }
})
const registry = createProviderRegistry([openai /*, claude, gemini */])
const adapter  = createAdapterFor(registry, 'openai')
```

---

## 5. Anti-hallucination (two complementary mechanisms)

Both are deterministic and grounded ONLY in the Sprint 4 context.

**Response Validator — hard reject → fallback.** Rejects when the answer or
confidence is missing, or a **citation** references an evidence id or a college
that was never supplied (an invented citation). Rejection triggers the retry, then
the deterministic fallback.

**Hallucination Guard — soft repair.** Splits the answer into sentences; a sentence
is **removed** when it:
- asserts a **cutoff / placement / fee figure** not present in the evidence
  (keyword-anchored, comma/₹/%/lakh/crore-normalized, years excluded), or
- names a **college** not in the context (institution-suffix phrase, determiner-stripped).

If nothing supported remains, the answer is **replaced** with
"I don't have sufficient evidence." The prompt (built in Sprint 4) already instructs
the model never to invent — the guard enforces it regardless of what the model does.

---

## 6. Real output samples (deterministic, from the fixture)

**`ok`** — validated, cited, unchanged:

```json
{ "status": "ok", "attempts": 1,
  "response": {
    "answer": "PSG College of Technology reports a median salary of 900000 INR/yr.",
    "citations": [{ "evidenceId": "retrieval-psg-…-median-salary-…-900000",
                    "collegeName": "PSG College of Technology",
                    "label": "Highest median salary (INR/yr)", "source": "retrieval" }],
    "confidence": "high", "hadMissingInformation": false },
  "issues": [] }
```

**`repaired`** — model slipped in a fabricated ₹9,999,999; the guard removed that
sentence and kept the supported one:

```json
{ "status": "repaired",
  "response": { "answer": "PSG College of Technology is strong.", … },
  "issues": [
    { "code": "fabricated_figure", "severity": "error",
      "message": "sentence asserts an unsupported figure: \"Its median salary is 9999999 rupees.\"" },
    { "code": "removed_unsupported_sentence", "severity": "warning", "message": "Its median salary is 9999999 rupees." }
  ] }
```

Other statuses: `unparseable` (bad JSON after retry), `rejected` (invented
citation after retry), `provider_error` (provider threw) — each returns the safe,
low-confidence fallback, never a fabricated answer.

---

## 7. Test summary (46 tests, 8 files)

- `provider` (6) — function/static/unavailable, async, non-string rejection, swappability
- `parser` (11) — bare/fenced/embedded JSON, brace-in-string, missing-answer fail,
  confidence coercion, malformed citation/follow-up dropping
- `validator` (5) — grounding contents; reject unknown citation, unknown cited
  college, missing answer, invalid confidence
- `guard` (7) — keep supported figure, remove fabricated figure, remove hallucinated
  college, ignore years, ignore generic "This College", fabricated-vs-real percentage,
  fully-supported answer unchanged
- `adapter` (9) — ok, repaired, retry-then-succeed, attempt counting, and the three
  fallback paths (unparseable/rejected/provider_error), determinism
- `factory` (4) — registry register/get/list, unknown-provider throw, swap, adapter build
- `integration` (4) — S4→S5 end-to-end: citations reference real evidence, invented
  college stripped from prose, safe degrade, determinism

---

## 8. Validation report

| Gate | Command | Result |
|------|---------|--------|
| TypeScript (app, `strictNullChecks`) | `tsc --noEmit --incremental false` | **0 errors** in `lib/ai/llm` |
| TypeScript (tests) | `tsc -p tsconfig.test.json` | **0 errors** |
| No `any` (source) | grep | **0** |
| Forbidden imports (OpenAI/Anthropic/Gemini/vector/embeddings/streaming) | grep | **0** |
| Circular dependencies | `madge --circular` (llm + all deps, alias-resolved) | **none** (197 files) |
| LLM layer tests | `vitest run lib/ai/llm` | **46 passed** |
| Full regression | `vitest run` | **331 passed / 6 skipped** (hermetic) |
| Full regression + real warehouse | `CYC_DATA_DIR=… vitest run` | **337 passed / 0 skipped** |
| Dependency boundary | import audit | only `@/lib/ai/orchestration` |

---

## 9. Production readiness

**Ready** as a provider-agnostic integration layer. It is fully typed (no `any`),
acyclic, deterministic, config-driven, and DI-based. It **cannot leak invented
data**: invented citations are rejected, unsupported factual sentences are removed,
and every failure mode collapses to a safe, low-confidence fallback derived from
the context — it never throws and never streams.

**Remaining work before going live (Sprint 6+):**
1. **Real provider adapters** — implement `LLMProvider` for OpenAI, Claude, and
   Gemini by wrapping each SDK in `createFunctionProvider` (no adapter changes).
   Map provider errors to `ProviderError`; add timeouts/retry-with-backoff at the
   provider level.
2. **Secrets & config** — API keys via env, model routing, per-provider rate limits.
3. **Telemetry** — record status, attempts, issue codes, and token usage
   (adapters exist under `@/lib/ai/adapters`).
4. **Transport/UI** — API route + streaming are explicitly out of scope here and
   belong to a later delivery layer.

**No LLM SDK is integrated, by design.** The layer is ready to connect to GPT,
Claude, or Gemini by registering a provider — with no change to parsing,
validation, or the hallucination guard.
