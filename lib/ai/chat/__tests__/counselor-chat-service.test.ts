/**
 * @module lib/ai/chat/__tests__/counselor-chat-service.test
 *
 * Counselor chat service integration — the live /api/chat flow with the LLM as
 * the final reasoning layer, using deterministic provider doubles (NO network).
 * Proves: grounded model answer, TN prompt delivery, deterministic degradation
 * without a provider, hallucination rejection, validation, and continuity.
 */

import { describe, expect, it } from 'vitest'
import {
  createFunctionProvider,
  createUnavailableProvider,
  composeCounselorSystem,
  type LLMProvider,
  type PromptMessage,
} from '@/lib/ai/llm'
import { createOpinionService } from '@/lib/opinion'
import {
  createCounselorChatService,
  createInMemorySessionStore,
  createNullLogger,
  type ChatResponse,
} from '@/lib/ai/chat'
import { makeHarness } from '../../orchestration/__tests__/support'

const { repos, retrieval } = makeHarness()

/** A provider that grounds itself: cites the first evidence id in the prompt. */
function groundingProvider(): { provider: LLMProvider; lastMessages: () => readonly PromptMessage[] } {
  let last: readonly PromptMessage[] = []
  const provider = createFunctionProvider('openai', (req) => {
    last = req.messages
    const id = req.messages.map((m) => m.content).join('\n').match(/\[([^\]\s]+)\]/)?.[1] ?? null
    return {
      text: JSON.stringify({
        answer: 'Based on the verified evidence, here is my counsel.',
        citations: id ? [{ evidenceId: id, collegeName: null, label: 'evidence', source: 'retrieval' }] : [],
        confidence: 'high',
        hadMissingInformation: false,
      }),
    }
  })
  return { provider, lastMessages: () => last }
}

/** A provider that fabricates an evidence id (forces rejection → deterministic). */
const fabricatingProvider = (): LLMProvider =>
  createFunctionProvider('openai', () => ({
    text: JSON.stringify({ answer: 'Nonexistent Institute of Nowhere is best.', citations: [{ evidenceId: 'fake', collegeName: null, label: 'x', source: 'retrieval' }], confidence: 'high' }),
  }))

let counter = 0
function makeCounselor(provider: LLMProvider) {
  const opinion = createOpinionService(repos, retrieval, { provider, systemPrompt: composeCounselorSystem() })
  const store = createInMemorySessionStore()
  const service = createCounselorChatService({
    opinion,
    sessionStore: store,
    logger: createNullLogger(),
    clock: () => 0,
    idGenerator: () => `conv-${(counter += 1)}`,
    timeoutMs: 2000,
  })
  return { service, store }
}

const ok = (body: unknown): ChatResponse => body as ChatResponse

describe('counselor chat service — LLM reasoning path', () => {
  it('returns 200 with a grounded model answer + preserved citations', async () => {
    const { provider } = groundingProvider()
    const { service } = makeCounselor(provider)
    const outcome = await service.handle({ message: 'Which college is best for AI & DS with my cutoff?' })
    expect(outcome.httpStatus).toBe(200)
    const body = ok(outcome.body)
    expect(body.answer).toBe('Based on the verified evidence, here is my counsel.')
    expect(body.citations.length).toBeGreaterThan(0)
    expect(['high', 'medium', 'low']).toContain(body.confidence)
  })

  it('delivers the Tamil Nadu counselor system prompt to the model', async () => {
    const { provider, lastMessages } = groundingProvider()
    await makeCounselor(provider).service.handle({ message: 'recommend the best college' })
    expect(lastMessages()[0].content).toMatch(/Tamil Nadu/)
    expect(lastMessages()[0].content).toMatch(/never invent/i)
  })
})

describe('counselor chat service — grounding & degradation', () => {
  it('still answers (deterministically, 200) when no LLM provider is configured', async () => {
    const { service } = makeCounselor(createUnavailableProvider('none'))
    const outcome = await service.handle({ message: 'recommend the best college' })
    expect(outcome.httpStatus).toBe(200) // NOT 503 — grounded fallback
    expect(ok(outcome.body).answer.length).toBeGreaterThan(0)
  })

  it('rejects a hallucinating model and returns the grounded deterministic answer', async () => {
    const { service } = makeCounselor(fabricatingProvider())
    const outcome = await service.handle({ message: 'recommend the best college' })
    expect(outcome.httpStatus).toBe(200)
    expect(ok(outcome.body).answer).not.toMatch(/Nonexistent Institute/i)
  })

  it('says it lacks evidence for an unrecognized query', async () => {
    const { service } = makeCounselor(createUnavailableProvider('none'))
    const body = ok((await service.handle({ message: 'asdfghjkl qwerty' })).body)
    expect(body.answer.toLowerCase()).toMatch(/enough (verified )?(information|evidence)/)
  })
})

describe('counselor chat service — HTTP + continuity', () => {
  it('rejects invalid and empty payloads', async () => {
    const { service } = makeCounselor(createUnavailableProvider('none'))
    expect((await service.handle('nope')).httpStatus).toBe(400)
    expect((await service.handle({ message: '   ' })).httpStatus).toBe(400)
  })

  it('threads conversation state across turns', async () => {
    const { service, store } = makeCounselor(createUnavailableProvider('none'))
    const first = ok((await service.handle({ message: 'placements at PSG College of Technology' })).body)
    await service.handle({ message: 'compare it with Anna University', conversationId: first.conversationId })
    const state = await store.get(first.conversationId)
    expect(state?.turnCount).toBe(2)
  })

  it('is deterministic without a provider', async () => {
    const a = ok((await makeCounselor(createUnavailableProvider('none')).service.handle({ message: 'recommend the best college' })).body)
    const b = ok((await makeCounselor(createUnavailableProvider('none')).service.handle({ message: 'recommend the best college' })).body)
    expect(a.answer).toBe(b.answer)
  })
})
