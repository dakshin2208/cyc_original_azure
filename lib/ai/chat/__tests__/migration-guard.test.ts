/**
 * @module lib/ai/chat/__tests__/migration-guard.test
 *
 * MIGRATION GUARD (Gap-Analysis Stage 0 — "freeze the map & guard the trust path").
 *
 * These are characterization tests: they pin the CURRENT, correct behavior of the
 * live counselor path so the later migration stages can be verified as safe. Each
 * block is labeled with the stage it protects. If a later stage breaks one of these,
 * it has changed behavior the frozen architecture requires to be preserved.
 *
 *   Stage 1 (delete dead scaffold) ...... the two grounding gates + deterministic
 *                                         fallback must remain intact and un-bypassed.
 *   Stage 2 (durable conversation state)  continuity across turns must be preserved
 *                                         when the session store changes.
 *   Stage 3 (extract Orchestration Brain) capability routing must stay distinct — the
 *                                         relocated router must produce the same
 *                                         per-capability answers, never one fallback.
 *   Stage 4 (instrument the trust path) . wrapping the finaliser for metrics must not
 *                                         weaken the hallucination/grounding guard.
 *
 * Uses the shared fixture warehouse + deterministic provider doubles (NO network),
 * exactly like counselor-chat-service.test.ts.
 */

import { describe, expect, it } from 'vitest'
import {
  createFunctionProvider,
  createUnavailableProvider,
  composeCounselorSystem,
  type LLMProvider,
} from '@/lib/ai/llm'
import { createOpinionService } from '@/lib/opinion'
import {
  createCounselorChatService,
  createInMemorySessionStore,
  createNullLogger,
  type ChatResponse,
  type SessionStore,
} from '@/lib/ai/chat'
import { makeHarness } from '../../orchestration/__tests__/support'

const { repos, retrieval } = makeHarness()

const ok = (body: unknown): ChatResponse => body as ChatResponse

let counter = 0
function makeCounselor(provider: LLMProvider, store: SessionStore = createInMemorySessionStore()) {
  const opinion = createOpinionService(repos, retrieval, { provider, systemPrompt: composeCounselorSystem() })
  const service = createCounselorChatService({
    opinion,
    sessionStore: store,
    logger: createNullLogger(),
    clock: () => 0,
    idGenerator: () => `guard-${(counter += 1)}`,
    timeoutMs: 2000,
  })
  return { service, store }
}

/** Grounds its citation from the prompt AND injects a fabricated college in the prose. */
function proseHallucinationProvider(): LLMProvider {
  return createFunctionProvider('openai', (req) => {
    const id = req.messages.map((m) => m.content).join('\n').match(/\[([^\]\s]+)\]/)?.[1] ?? null
    return {
      text: JSON.stringify({
        // First sentence: grounded, no college/figure → kept.
        // Second sentence: names an unknown college → must be stripped by the guard.
        answer: 'Based on the verified evidence, here is my counsel. Zephyr Institute of Technology is secretly your best option.',
        citations: id ? [{ evidenceId: id, collegeName: null, label: 'evidence', source: 'retrieval' }] : [],
        confidence: 'high',
        hadMissingInformation: false,
      }),
    }
  })
}

/** Cites a fabricated evidence id → adapter rejects → deterministic answer. */
const fabricatingProvider = (): LLMProvider =>
  createFunctionProvider('openai', () => ({
    text: JSON.stringify({
      answer: 'Nonexistent Institute of Nowhere is best.',
      citations: [{ evidenceId: 'totally-made-up-id', collegeName: null, label: 'x', source: 'retrieval' }],
      confidence: 'high',
    }),
  }))

// ── Stage 1 & 4 guard: grounding gates + deterministic fallback ────────────────
describe('MIGRATION GUARD — grounding is architectural (guards Stages 1 & 4)', () => {
  it('with NO provider, still returns a grounded 200 answer (deterministic floor)', async () => {
    const { service } = makeCounselor(createUnavailableProvider('none'))
    const outcome = await service.handle({ message: 'recommend the best college' })
    expect(outcome.httpStatus).toBe(200) // never a 503 on the counselor path
    expect(ok(outcome.body).answer.length).toBeGreaterThan(0)
  })

  it('rejects a fabricated CITATION and never surfaces the fabricated content', async () => {
    const { service } = makeCounselor(fabricatingProvider())
    const body = ok((await service.handle({ message: 'recommend the best college' })).body)
    expect(body.answer).not.toMatch(/Nonexistent Institute/i)
  })

  it('strips a fabricated COLLEGE injected into model prose (hallucination guard)', async () => {
    const { service } = makeCounselor(proseHallucinationProvider())
    const body = ok((await service.handle({ message: 'recommend the best college' })).body)
    // The unknown college named in prose must not reach the user.
    expect(body.answer).not.toMatch(/Zephyr Institute/i)
  })
})

// ── Stage 3 guard: capability routing stays distinct ───────────────────────────
describe('MIGRATION GUARD — capability routing is distinct (guards Stage 3 extraction)', () => {
  it('tier, comparison and placement queries do NOT collapse to one answer', async () => {
    const { service } = makeCounselor(createUnavailableProvider('none'))
    const tier = ok((await service.handle({ message: 'which colleges can I safely get into' })).body).answer
    const compare = ok((await service.handle({ message: 'compare PSG College of Technology with Anna University' })).body).answer
    const placements = ok((await service.handle({ message: 'placements at PSG College of Technology' })).body).answer

    for (const a of [tier, compare, placements]) expect(a.length).toBeGreaterThan(0)
    // A total routing collapse would make all three identical. Require at least two
    // materially different answers — the property the extracted brain must preserve.
    expect(new Set([tier, compare, placements]).size).toBeGreaterThanOrEqual(2)
  })
})

// ── Stage 2 guard: conversation continuity is preserved ────────────────────────
describe('MIGRATION GUARD — conversation continuity (guards Stage 2 durability)', () => {
  it('threads state across turns on the same conversationId', async () => {
    const { service, store } = makeCounselor(createUnavailableProvider('none'))
    const first = ok((await service.handle({ message: 'placements at PSG College of Technology' })).body)
    await service.handle({ message: 'compare it with Anna University', conversationId: first.conversationId })
    const state = await store.get(first.conversationId)
    // Stage 2 swaps this in-memory store for a durable one; turnCount continuity
    // across turns is the behavior it must keep.
    expect(state?.turnCount).toBe(2)
  })
})
