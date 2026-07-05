/**
 * @module lib/ai/audit/trace.test
 *
 * READ-ONLY PIPELINE INSTRUMENTATION (no business logic touched).
 *
 * Reconstructs the EXACT production pipeline that `/api/chat` runs —
 *   getChatService() → buildCounselorChatService({}) → createOpinionService(...)
 *   advise(): orchestrate → engine.prepare → adapter.respond → engine.complete
 * — using the same factories and the same production defaults (cutoffs: undefined,
 * counselor system prompt), then prints every intermediate stage so we can find
 * the root cause of weak recommendations. It imports and calls the real modules;
 * it does NOT modify parsing, retrieval, scoring, prompts, or the LLM integration.
 *
 * Run:  CYC_DATA_DIR=/path/to/warehouse npx vitest run lib/ai/audit/trace.test.ts
 */

import { describe, it, expect } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createAIOrchestrator } from '@/lib/ai/orchestration'
import { createOpinionEngine } from '@/lib/opinion/engine/opinion-engine'
import {
  createLLMAdapter,
  createFunctionProvider,
  createUnavailableProvider,
  composeCounselorSystem,
  type CompletionRequest,
} from '@/lib/ai/llm'

const QUERY = process.env.AUDIT_QUERY ?? 'CSE in Coimbatore with 190 cutoff BC'
const DIR = process.env.CYC_DATA_DIR

const bar = (t: string) => console.log('\n' + '━'.repeat(80) + '\n' + t + '\n' + '━'.repeat(80))
const j = (o: unknown) => console.log(JSON.stringify(o, null, 2))

// Skip in the normal suite (needs the real warehouse); run explicitly with CYC_DATA_DIR set.
describe.skipIf(!DIR)('AI Counselor — full pipeline trace (read-only audit)', () => {
  it('traces every stage for a single query', async () => {
    if (!DIR) return

    // ── Build the pipeline EXACTLY as production does (production passes no cutoffs). ──
    const repos = createRepositories(buildWarehouseFromDirectory(DIR))
    const retrieval = createRetrievalEngine(repos)
    const orchestrator = createAIOrchestrator(repos, retrieval, { cutoffs: undefined })
    const engine = createOpinionEngine({ reco: orchestrator.reco })
    const systemPrompt = composeCounselorSystem()

    bar('1. USER QUERY')
    console.log(QUERY)

    // ── orchestrate() = parse → retrieval/recommendation engines → evidence → context ──
    const orch = orchestrator.orchestrate(QUERY)

    bar('2. PARSED INTENT  (intent / branch / cutoff / community / district / college / constraints / entities)')
    j(orch.parsed)

    bar('3. RETRIEVAL STAGE  (context: retrieved evidence, recommendations, comparison, subjects, follow-ups)')
    j(orch.context)

    // ── engine.prepare() = strategy → dossiers → deterministic recommendations → prompt ──
    const prepared = engine.prepare(orch.parsed, orch.context, { systemPrompt })

    bar('4. RECOMMENDATION STAGE  (deterministic OpinionResult: ranked candidates + scores + rationale)')
    j(prepared.result)

    bar('5. EVIDENCE BUNDLE the LLM is grounded on  (prepared.groundingContext)')
    j(prepared.groundingContext)

    bar('6. FINAL PROMPT SENT TO GPT-4.1  (prepared.prompt.messages: system + user)')
    j(prepared.prompt)

    // ── Capture the EXACT request the provider would POST (confirms what GPT receives). ──
    let captured: CompletionRequest | null = null
    const capturing = createFunctionProvider('openai', (req) => {
      captured = req
      return { text: '{"answer":"(capture only)","citations":[],"confidence":"low"}' }
    })
    try {
      await createLLMAdapter(capturing).respond(prepared.prompt, prepared.groundingContext)
    } catch {
      /* capture only */
    }
    bar('6b. EXACT REQUEST THAT WOULD BE POSTED TO AZURE GPT-4.1  (captured CompletionRequest)')
    j(captured)

    // ── Stage 7: real current behavior. No Azure creds in env → provider unavailable → fallback. ──
    const adapter = createLLMAdapter(createUnavailableProvider('none'))
    const llm = await adapter.respond(prepared.prompt, prepared.groundingContext)
    bar('7. RAW GPT RESPONSE')
    console.log(
      '(No Azure creds in env → LLM provider unavailable → GPT-4.1 NOT called; the adapter\n' +
        ' returned its deterministic fallback. This is what production returns without creds.\n' +
        ' Set OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT in .env.local to capture a real response.)',
    )
    j(llm)

    // ── engine.complete() = validate model (rejected here) → format → OpinionResponse ──
    const response = engine.complete(prepared, orch.context.followUpQuestions, llm)

    bar('8. FINAL API RESPONSE returned to the frontend  (mapped as counselor-chat-service does)')
    j({
      httpStatus: 200,
      llmStatus: response.usedModel ? 'model' : 'deterministic',
      body: {
        answer: response.answer,
        citations: response.evidence,
        confidence: response.confidence,
        followUps: response.followUps,
      },
    })

    bar('8b. FULL OpinionResponse (every field, for completeness)')
    j(response)

    expect(orch.parsed).toBeDefined()
  }, 60_000)
})
