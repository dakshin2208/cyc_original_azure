# LLM Reasoning Layer (Sprint 9) — OpenAI-backed AI Counselor

Transforms the deterministic RAG chatbot into a production AI Counselor that uses
an LLM **only for reasoning**. The warehouse stays the single source of truth; the
recommendation engine still ranks; the LLM only explains, compares, personalises,
and converses — grounded strictly in supplied evidence.

> Nothing in retrieval / recommendation / warehouse / orchestration / UI was
> rebuilt or bypassed. The genuine gaps — a **real OpenAI client**, its **wiring**,
> the **counselor system prompt**, and routing `/api/chat` through the **Opinion
> Engine** — were added; everything else is reused.

## 1. Architecture

```
User (React ChatWidget, unchanged)
   │  POST /api/chat            (route unchanged)
   ▼
getChatService()  →  Counselor Chat Service            [NEW: lib/ai/chat/counselor-chat-service.ts]
   │  validate · session · turn-history · timeout · logging (HTTP glue only)
   ▼
OpinionService.advise            (REUSED, Sprint 8)
   ├─ AIOrchestrator.orchestrate  →  Warehouse Retrieval + Recommendation Engine   (REUSED, deterministic)
   │        └─ RecommendationResult[] + Evidence + Context   ← CSV warehouse = source of truth
   ├─ OpinionEngine.prepare  →  deterministic Recommendation objects + counselor PROMPT
   │        (system prompt = TN Engineering Admissions Counselor)                  [NEW prompt]
   ▼
LLMAdapter.respond  →  OpenAI provider                                             [NEW: lib/ai/llm/providers/openai]
   │   parse → validate (reject invented citations/colleges)
   │   → hallucination-guard (strip fabricated figures/colleges)   (REUSED, Sprint 5)
   ▼
OpinionEngine.complete → OpinionValidator + Formatter (REUSED, Sprint 8)
   │   model answer if it validates, else DETERMINISTIC grounded answer
   ▼
HTTP 200  { answer, citations, confidence, followUps, conversationId }
```

**The LLM is used ONLY for reasoning.** It never retrieves, ranks, or fabricates:
the Sprint-5 guard rejects invented citations/colleges and strips fabricated
figures; the Sprint-8 validator discards the model entirely when evidence is
insufficient; on any failure the formatter returns the grounded deterministic
answer (so the endpoint always returns 200 with a safe answer).

## 2. Folder structure (additions)

```
lib/ai/llm/
├── providers/                         # NEW — concrete providers + env wiring
│   ├── index.ts                       #   configuredProviderRegistry / resolveConfiguredProvider
│   └── openai/
│       ├── config.ts                  #   env → OpenAiConfig (key from OPENAI_API_KEY, never hardcoded)
│       ├── openai-provider.ts         #   OpenAI Chat Completions client (LLMProvider)
│       └── __tests__/openai-provider.test.ts
│   └── __tests__/wiring.test.ts
├── prompts/                           # NEW — reusable system prompts
│   ├── index.ts
│   └── tn-counselor-system.ts         #   TN Engineering Admissions Counselor persona + rules
lib/ai/chat/
├── counselor-chat-service.ts          # NEW — /api/chat → Opinion Engine (LLM reasoning) → chat contract
└── __tests__/counselor-chat-service.test.ts
```

## 3. Files created (8)
- `lib/ai/llm/providers/openai/config.ts`, `openai-provider.ts`
- `lib/ai/llm/providers/index.ts`
- `lib/ai/llm/prompts/tn-counselor-system.ts`, `prompts/index.ts`
- `lib/ai/chat/counselor-chat-service.ts`
- Tests: `openai-provider.test.ts`, `providers/__tests__/wiring.test.ts`, `counselor-chat-service.test.ts`

## 4. Files modified (additive / wiring only — no logic replaced)
- `lib/ai/llm/index.ts` — export the new providers + prompts.
- `lib/ai/chat/index.ts` — export the counselor service.
- `lib/ai/chat/container.ts` — repoint `getChatService` → `buildCounselorChatService` (the DI seam; `buildChatService` remains available).
- `lib/opinion/models/response.ts` — `OpinionOptions.systemPrompt?` (optional).
- `lib/opinion/prompt/opinion-prompt-builder.ts` — optional `systemPrompt` override (default unchanged).
- `lib/opinion/engine/opinion-engine.ts` — thread `systemPrompt`; **+ genuine bug fix**: `PreparedOpinion.groundingContext` so the adapter grounds on the same (possibly fallback-enriched) context the prompt was built from.
- `lib/opinion/service/opinion-service.ts` — accept `systemPrompt`; ground on `prepared.groundingContext`.
- `.env.example` — document `OPENAI_API_KEY` (+ `OPENAI_MODEL`/`OPENAI_BASE_URL`/`OPENAI_TIMEOUT_MS`/`OPENAI_MAX_OUTPUT_TOKENS`/`COUNSELOR_TIMEOUT_MS`) and `CYC_DATA_DIR`.

**NOT touched:** the warehouse, retrieval engine, recommendation engine, AI
orchestrator, `/api/chat` route, and the React UI.

## 5. The OpenAI client (deliverables 1–17 mapped to reused vs new)
- **LLM abstraction** — reused `LLMProvider` (Sprint 5).
- **OpenAI client** — NEW: `POST {OPENAI_BASE_URL}/chat/completions`, `Authorization: Bearer $OPENAI_API_KEY` (**key from env, never hardcoded**), `response_format: json_object`, temperature 0.
- **Prompt/system/user/evidence/structured prompt** — reused Sprint 8 `buildOpinionPrompt` + NEW TN system prompt.
- **Response parser · hallucination guardrails · citation/confidence preservation** — reused Sprint 5 parser/validator/guard + Sprint 8 validator/formatter.
- **Conversation history** — session state (Sprint 4) + in-memory turn-text history in the counselor service.
- **Token management** — bounded evidence (24) + history (6 turns) + `max_tokens` (`OPENAI_MAX_OUTPUT_TOKENS`).
- **Error / timeout / retry** — provider: AbortController timeout + exponential-backoff retry on 429/5xx/network; adapter: retry + deterministic fallback; service: backstop timeout → 504.
- **Logging** — structured events (request, reasoning model/deterministic, latency, response) via the existing `ChatLogger`.

## 6. Prompt design (TN counselor system prompt)
Instructs the model to: act as an experienced **Tamil Nadu Engineering Admissions
counselor**; use **only** supplied RECOMMENDATIONS/EVIDENCE; **never invent** a
college, cutoff, salary, placement, fee, or ranking; keep the engine's
safe/moderate/ambitious verdicts and comparison winners intact; say exactly **"I
don't have enough verified information."** when evidence is insufficient; compare
colleges with trade-offs/ROI/placement; personalise to the student's
cutoff/community/branch/priorities/budget; give practical guidance; stay concise;
and attach evidence-id citations to every factual claim.

## 7. Validation report

| Gate | Result |
|------|--------|
| TypeScript (app) | **0 errors** in new/touched areas |
| TypeScript (tests) | **0 errors** |
| No `any` (new source) | **0** |
| Circular dependencies (`madge`, all layers) | **none** |
| Full regression | **464 passed / 10 skipped** (hermetic) · **474 / 0** (real warehouse) |
| Retrieval / recommendation / warehouse / route / UI modified | **0** |
| Real-warehouse E2E (stub OpenAI) | example queries → **HTTP 200**, LLM-reasoned answer, real citations; unrecognized → graceful "not enough evidence" |

## 8. Test report (+21 tests)
- `openai-provider` (7) — request/header/model/`response_format` mapping, key-from-config, 401 no-retry, 429→retry, 500 exhaust, timeout→ProviderError, empty→error.
- `wiring` (6) — `readOpenAiConfig` (null without key, defaults/overrides), `resolveConfiguredProvider` (openai when keyed, else unavailable), registry gating, TN prompt policy.
- `counselor-chat-service` (8) — grounded model answer + preserved citations; **TN prompt delivered to model**; **200 grounded fallback without a provider** (not 503); **hallucination rejected → deterministic**; insufficient-evidence message; 400 validation; continuity; determinism.

## 9. Production readiness
**Ready.** Set `OPENAI_API_KEY` (and `CYC_DATA_DIR`) in the existing environment and
`/api/chat` immediately reasons with OpenAI — no deployment/infrastructure change,
no hardcoded key, no code change. Without the key it still answers deterministically
from warehouse evidence (graceful degradation, HTTP 200). The LLM cannot leak
invented data: citations must reference supplied evidence, fabricated
figures/colleges are stripped, insufficient evidence yields the fixed "I don't have
enough verified information." message, and every failure mode falls back to the
grounded deterministic answer. Retrieval stays deterministic; the LLM is only the
final reasoning layer. `OPENAI_BASE_URL` allows pointing at an OpenAI-compatible
gateway (incl. Azure-compatible) without code change.
