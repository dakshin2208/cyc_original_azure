/**
 * @module lib/opinion/__tests__/formatter.test
 * Opinion Formatter (Module 6) — response contract + deterministic fallback.
 */

import { describe, expect, it } from 'vitest'
import type { AIResponse } from '@/lib/ai/orchestration'
import type { LLMResult } from '@/lib/ai/llm'
import { makeOpinion, orchestrator } from './support'

const svc = makeOpinion()
const orch = orchestrator.orchestrate('recommend the best college')
const prepared = svc.engine.prepare(orch.parsed, orch.context)
const evidenceId = prepared.opinionContext.evidence.items[0]?.id ?? 'ev'
const candidate = prepared.opinionContext.candidates[0]?.college.name ?? 'X'

const okLlm = (answer: string): LLMResult => ({
  status: 'ok',
  response: { answer, citations: [{ evidenceId, collegeName: candidate, label: 'x', source: 'retrieval' }], followUps: [], confidence: 'high', hadMissingInformation: false } satisfies AIResponse,
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

describe('formatOpinion (via engine.complete)', () => {
  it('uses the model answer when it validates', () => {
    const res = svc.engine.complete(prepared, orch.context.followUpQuestions, okLlm('Model counsel here.'))
    expect(res.usedModel).toBe(true)
    expect(res.answer).toBe('Model counsel here.')
    expect(res.evidence.length).toBeGreaterThan(0)
  })

  it('falls back to a deterministic, grounded answer when the model is unusable', () => {
    const res = svc.engine.complete(prepared, orch.context.followUpQuestions, failedLlm)
    expect(res.usedModel).toBe(false)
    expect(res.answer.length).toBeGreaterThan(0)
    expect(res.answer).toContain('Recommended pick')
    // Deterministic path still cites the opinion evidence.
    expect(res.evidence.some((c) => c.evidenceId === evidenceId)).toBe(true)
  })

  it('always carries the deterministic recommendation summary', () => {
    const res = svc.engine.complete(prepared, orch.context.followUpQuestions, failedLlm)
    expect(res.recommendationSummary.length).toBeGreaterThan(0)
    expect(res.recommendationSummary[0].kind).toBe('top_pick')
    expect(res.strategy).toBe('college_recommendation')
  })
})
