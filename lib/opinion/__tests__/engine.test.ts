/**
 * @module lib/opinion/__tests__/engine.test
 * Opinion Engine facade — prepare/complete + the grounded quality-fallback path.
 */

import { describe, expect, it } from 'vitest'
import type { AIResponse } from '@/lib/ai/orchestration'
import type { LLMResult } from '@/lib/ai/llm'
import { makeOpinion, orchestrator } from './support'

const svc = makeOpinion()

const okLlm = (answer: string, evidenceId: string, college: string): LLMResult => ({
  status: 'ok',
  response: { answer, citations: [{ evidenceId, collegeName: college, label: 'x', source: 'retrieval' }], followUps: [], confidence: 'high', hadMissingInformation: false } satisfies AIResponse,
  issues: [],
  attempts: 1,
  raw: '{}',
  provider: 'test',
})

const failedLlm: LLMResult = {
  status: 'provider_error',
  response: { answer: '', citations: [], followUps: [], confidence: 'low', hadMissingInformation: false },
  issues: [],
  attempts: 2,
  raw: null,
  provider: 'test',
}

describe('opinion engine — prepare', () => {
  it('builds context, recommendations, and a prompt for a recommendation query', () => {
    const { parsed, context } = orchestrator.orchestrate('recommend the best college')
    const prepared = svc.engine.prepare(parsed, context)
    expect(prepared.opinionContext.candidates.length).toBeGreaterThan(0)
    expect(prepared.result.recommendations[0].kind).toBe('top_pick')
    expect(prepared.prompt.messages).toHaveLength(2)
  })

  it('applies a grounded quality fallback when orchestration yields no candidates', () => {
    const { parsed, context } = orchestrator.orchestrate('I scored 182')
    // Precondition: eligibility with a missing community is blocked upstream.
    expect(context.recommendations).toHaveLength(0)
    const prepared = svc.engine.prepare(parsed, context)
    // The engine recovers a grounded overall-quality baseline…
    expect(prepared.opinionContext.candidates.length).toBeGreaterThan(0)
    // …and flags eligibility as unconfirmed rather than inventing it.
    expect(prepared.result.recommendations.flatMap((r) => r.risks).join(' ')).toMatch(/eligibility/i)
  })

  it('does NOT fabricate candidates for an unrecognized query', () => {
    const { parsed, context } = orchestrator.orchestrate('asdfghjkl qwerty')
    const prepared = svc.engine.prepare(parsed, context)
    expect(prepared.result.strategy).toBe('insufficient_evidence')
    expect(prepared.opinionContext.candidates).toHaveLength(0)
  })

  it('is deterministic', () => {
    const { parsed, context } = orchestrator.orchestrate('recommend the best college')
    const a = svc.engine.prepare(parsed, context)
    const b = svc.engine.prepare(parsed, context)
    expect(a.result.recommendations).toEqual(b.result.recommendations)
  })
})

describe('opinion engine — complete', () => {
  const { parsed, context } = orchestrator.orchestrate('recommend the best college')
  const prepared = svc.engine.prepare(parsed, context)
  const evidenceId = prepared.opinionContext.evidence.items[0]?.id ?? 'ev'
  const college = prepared.opinionContext.candidates[0]?.college.name ?? 'X'

  it('accepts a validating model answer', () => {
    const res = svc.engine.complete(prepared, context.followUpQuestions, okLlm('Grounded counsel.', evidenceId, college))
    expect(res.usedModel).toBe(true)
    expect(res.answer).toBe('Grounded counsel.')
  })

  it('falls back to the deterministic answer when the model is unusable', () => {
    const res = svc.engine.complete(prepared, context.followUpQuestions, failedLlm)
    expect(res.usedModel).toBe(false)
    expect(res.recommendationSummary.length).toBeGreaterThan(0)
  })
})
