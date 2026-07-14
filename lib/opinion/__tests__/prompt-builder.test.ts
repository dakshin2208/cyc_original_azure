/**
 * @module lib/opinion/__tests__/prompt-builder.test
 * Opinion Prompt Builder (Module 4) — counselor policy, grounded serialization,
 * conversation history, uncertainty instruction, provider-agnostic messages.
 */

import { describe, expect, it } from 'vitest'
import type { EvidencePackage } from '@/lib/ai/orchestration'
import { buildOpinionPrompt, type OpinionContext, type OpinionRecommendation, type OpinionResult } from '@/lib/opinion'

const evidence: EvidencePackage = {
  items: [
    { id: 'ev:median', collegeName: 'Alpha College', dimension: 'placement', label: 'Median salary', value: 900000, source: 'retrieval', origin: 'placement', confidence: 0.95, confidenceLevel: 'high' },
  ],
  count: 1,
  bySource: { recommendation: 0, comparison: 0, retrieval: 1, warehouse: 0 },
}

const recommendation: OpinionRecommendation = {
  id: 'rec:1',
  kind: 'top_pick',
  colleges: ['Alpha College'],
  headline: 'Recommended pick',
  reasoning: ['Alpha College: Strong placements.'],
  evidenceIds: ['ev:median'],
  confidence: 'high',
  tradeoffs: ['Alpha College: Relatively weaker research.'],
  risks: ['Eligibility is unconfirmed (no historical cutoff data).'],
}

const context: OpinionContext = {
  strategy: 'college_recommendation',
  priorities: ['overall'],
  studentCutoff: null,
  community: null,
  branch: null,
  candidates: [],
  comparison: null,
  evidence,
  missingInformation: [{ field: 'fees_dataset', severity: 'degraded', reason: 'tuition fees are not present in the dataset' }],
}

const result: OpinionResult = {
  strategy: 'college_recommendation',
  recommendations: [recommendation],
  confidence: 'high',
  missingInformation: context.missingInformation,
  evidenceIds: ['ev:median'],
}

const prompt = buildOpinionPrompt({
  question: 'Which college should I choose?',
  context,
  result,
  history: [
    { role: 'user', content: 'I want strong placements' },
    { role: 'assistant', content: 'Understood.' },
  ],
})

describe('buildOpinionPrompt', () => {
  it('embeds the counselor persona + anti-hallucination + uncertainty policy', () => {
    const sys = prompt.system.toLowerCase()
    expect(sys).toMatch(/counsell?or/) // "counselor" or "counsellor"
    expect(sys).toMatch(/never invent/)
    expect(sys).toMatch(/insufficient|clarifying/) // explicit uncertainty
    expect(sys).toMatch(/unavailable/)
  })

  it('serializes the recommendation with reasoning, trade-offs, risks, and evidence ids', () => {
    expect(prompt.context).toContain('RECOMMENDATIONS')
    expect(prompt.context).toContain('Recommended pick')
    expect(prompt.context).toContain('weaker research') // trade-off
    expect(prompt.context).toContain('Eligibility is unconfirmed') // risk
    expect(prompt.context).toContain('ev:median') // evidence id
  })

  it('includes the citable evidence, conversation history, and missing-info sections', () => {
    expect(prompt.context).toContain('EVIDENCE (use these ids ONLY in the "citations" array')
    expect(prompt.context).toContain('CONVERSATION SO FAR')
    expect(prompt.context).toContain('I want strong placements')
    expect(prompt.context).toMatch(/MISSING[\s\S]*fees/)
  })

  it('produces a provider-agnostic [system, user] message array with the output contract', () => {
    expect(prompt.messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(prompt.messages[0].content).toContain('JSON') // output contract
    expect(prompt.user).toBe('Which college should I choose?')
    expect(prompt.messages[1].content).toContain('STUDENT QUESTION:')
  })

  it('reports accurate metadata', () => {
    expect(prompt.metadata.hasRecommendations).toBe(true)
    expect(prompt.metadata.evidenceCount).toBe(1)
    expect(prompt.metadata.approxChars).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const again = buildOpinionPrompt({ question: 'Which college should I choose?', context, result, history: [{ role: 'user', content: 'I want strong placements' }, { role: 'assistant', content: 'Understood.' }] })
    expect(again.messages).toEqual(prompt.messages)
  })
})
