/**
 * @module lib/ai/chat/__tests__/trust-pipeline.test
 *
 * The Trust Pipeline seam (Phase 6). Proves it is a faithful pass-through to the reused
 * Opinion engine (parse/run delegate with identical args/results), and that the trust
 * property — a grounded, validated answer — is preserved when a query crosses the seam.
 */

import { describe, expect, it, vi } from 'vitest'
import { createOpinionService } from '@/lib/opinion'
import type { OpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider, createFunctionProvider } from '@/lib/ai/llm'
import { createOpinionTrustPipeline } from '@/lib/ai/chat'
import { makeHarness } from '../../orchestration/__tests__/support'

describe('Trust Pipeline — delegation to the Opinion engine', () => {
  it('parse() and run() delegate with identical args and results', async () => {
    const parse = vi.fn((q: string) => ({ normalized: q, colleges: [], hasMultipleColleges: false, outOfDomain: null, unverifiedCollege: false }) as never)
    const advise = vi.fn(async (_q: string, _o?: unknown) => ({ response: { answer: 'ok', evidence: [], confidence: 'low', followUps: [], recommendationSummary: [], strategy: 's', usedModel: false }, state: { turnCount: 1 } }) as never)
    const fakeOpinion = { engine: {}, parse, advise } as unknown as OpinionService

    const trust = createOpinionTrustPipeline(fakeOpinion)
    trust.parse('hello')
    expect(parse).toHaveBeenCalledWith('hello')

    const opts = { priorState: undefined, history: [], overrides: { exclude: undefined } }
    const result = await trust.run('a question', opts)
    expect(advise).toHaveBeenCalledWith('a question', opts)
    expect(result.response.answer).toBe('ok')
  })
})

describe('Trust Pipeline — trust property preserved across the seam', () => {
  const { repos, retrieval } = makeHarness()

  it('yields a grounded deterministic answer when no model is available', async () => {
    const opinion = createOpinionService(repos, retrieval, {
      provider: createUnavailableProvider('none'),
      systemPrompt: composeCounselorSystem(),
    })
    const trust = createOpinionTrustPipeline(opinion)
    const { response } = await trust.run('recommend the best college', {})
    expect(response.answer.length).toBeGreaterThan(0)
    expect(response.usedModel).toBe(false) // grounded fallback, not model prose
  })

  it('discards a hallucinated (fabricated-citation) model answer through the seam', async () => {
    const fabricating = createFunctionProvider('openai', () => ({
      text: JSON.stringify({ answer: 'Nonexistent Institute of Nowhere is best.', citations: [{ evidenceId: 'fake', collegeName: null, label: 'x', source: 'retrieval' }], confidence: 'high' }),
    }))
    const opinion = createOpinionService(repos, retrieval, { provider: fabricating, systemPrompt: composeCounselorSystem() })
    const trust = createOpinionTrustPipeline(opinion)
    const { response } = await trust.run('recommend the best college', {})
    expect(response.answer).not.toMatch(/Nonexistent Institute/i)
  })
})
