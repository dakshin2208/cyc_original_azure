/**
 * @module lib/ai/llm/__tests__/validator.test
 * Grounding + structural validation (hard reject on invented citations).
 */

import { describe, expect, it } from 'vitest'
import type { AIResponse } from '@/lib/ai/orchestration'
import { buildGrounding, validateResponse } from '@/lib/ai/llm'
import { ask, NAME } from './support'

const { context } = ask(`what are the placements at ${NAME.psg}`)
const grounding = buildGrounding(context)
const firstEvidence = context.evidence.items[0]

const base: AIResponse = {
  answer: 'Here is a summary.',
  citations: [],
  followUps: [],
  confidence: 'high',
  hadMissingInformation: false,
}

describe('buildGrounding', () => {
  it('collects evidence ids, known colleges, and allowed numbers', () => {
    expect(grounding.evidenceIds.size).toBeGreaterThan(0)
    expect(grounding.knownColleges.has(NAME.psg.toLowerCase())).toBe(true)
    const median = context.facts.find((f) => f.label.startsWith('Median'))?.value
    expect(typeof median).toBe('number')
    expect(grounding.allowedNumbers.has(String(median))).toBe(true)
  })
})

describe('validateResponse', () => {
  it('accepts a response that cites real evidence for a known college', () => {
    const res: AIResponse = {
      ...base,
      citations: [{ evidenceId: firstEvidence.id, collegeName: firstEvidence.collegeName, label: firstEvidence.label, source: firstEvidence.source }],
    }
    expect(validateResponse(res, grounding).ok).toBe(true)
  })

  it('rejects a citation that references an unknown evidence id', () => {
    const res: AIResponse = { ...base, citations: [{ evidenceId: 'fabricated-id', collegeName: null, label: 'x', source: 'retrieval' }] }
    const out = validateResponse(res, grounding)
    expect(out.ok).toBe(false)
    expect(out.issues.some((i) => i.code === 'unknown_citation')).toBe(true)
  })

  it('rejects a citation that references an unknown college', () => {
    const res: AIResponse = {
      ...base,
      citations: [{ evidenceId: firstEvidence.id, collegeName: 'Imaginary Institute of Everything', label: 'x', source: 'retrieval' }],
    }
    const out = validateResponse(res, grounding)
    expect(out.ok).toBe(false)
    expect(out.issues.some((i) => i.code === 'unknown_cited_college')).toBe(true)
  })

  it('rejects a missing answer and an invalid confidence', () => {
    expect(validateResponse({ ...base, answer: '  ' }, grounding).ok).toBe(false)
    const badConfidence = { ...base, confidence: 'certain' } as unknown as AIResponse
    const out = validateResponse(badConfidence, grounding)
    expect(out.ok).toBe(false)
    expect(out.issues.some((i) => i.code === 'missing_confidence')).toBe(true)
  })
})
