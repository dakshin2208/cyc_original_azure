/**
 * @module lib/ai/llm/__tests__/parser.test
 * Parser — raw completion → AIResponse, robust extraction + coercion.
 */

import { describe, expect, it } from 'vitest'
import { extractJsonObject, parseAIResponse } from '@/lib/ai/llm'

describe('extractJsonObject', () => {
  it('extracts a bare JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}')
  })

  it('extracts from a ```json fenced block', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('extracts JSON embedded in surrounding prose', () => {
    expect(extractJsonObject('Sure! {"a":1} hope that helps')).toBe('{"a":1}')
  })

  it('handles braces inside strings', () => {
    expect(extractJsonObject('{"a":"a } b","c":2}')).toBe('{"a":"a } b","c":2}')
  })

  it('returns null when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeNull()
  })
})

describe('parseAIResponse', () => {
  const valid = {
    answer: 'PSG has strong placements.',
    citations: [{ evidenceId: 'e1', collegeName: 'PSG', label: 'Median salary', source: 'retrieval' }],
    followUps: [{ question: 'Which branch?', expects: 'branch', reason: 'branch-specific' }],
    confidence: 'high',
    hadMissingInformation: false,
  }

  it('parses a valid response', () => {
    const r = parseAIResponse(JSON.stringify(valid))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.answer).toBe('PSG has strong placements.')
      expect(r.value.citations).toHaveLength(1)
      expect(r.value.confidence).toBe('high')
    }
  })

  it('fails when answer is missing or empty', () => {
    expect(parseAIResponse(JSON.stringify({ confidence: 'high' })).ok).toBe(false)
    expect(parseAIResponse(JSON.stringify({ answer: '   ', confidence: 'high' })).ok).toBe(false)
  })

  it('fails on non-JSON', () => {
    const r = parseAIResponse('the model refused to answer')
    expect(r.ok).toBe(false)
  })

  it('coerces an invalid confidence to "low"', () => {
    const r = parseAIResponse(JSON.stringify({ answer: 'hi', confidence: 'super-high' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.confidence).toBe('low')
  })

  it('drops malformed citations and follow-ups defensively', () => {
    const r = parseAIResponse(
      JSON.stringify({
        answer: 'hi',
        confidence: 'medium',
        citations: [{ collegeName: 'X' }, { evidenceId: 'ok', label: 'l', source: 'weird' }],
        followUps: [{ reason: 'no question' }, { question: 'Q?', expects: 'nonsense' }],
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.citations).toHaveLength(1) // the one without evidenceId dropped
      expect(r.value.citations[0].source).toBe('retrieval') // invalid source coerced
      expect(r.value.followUps).toHaveLength(1) // the one without question dropped
      expect(r.value.followUps[0].expects).toBe('college') // invalid expects coerced
    }
  })

  it('parses a fenced response with trailing prose', () => {
    const r = parseAIResponse('Here you go:\n```json\n' + JSON.stringify(valid) + '\n```\nThanks!')
    expect(r.ok).toBe(true)
  })
})
