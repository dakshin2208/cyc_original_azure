/**
 * @module lib/ai/orchestration/__tests__/normalizer.test
 * QuestionNormalizer — lower-casing, punctuation, whitespace, typo correction.
 */

import { describe, expect, it } from 'vitest'
import { normalizeQuestion } from '@/lib/ai/orchestration'

describe('question normalizer', () => {
  it('lower-cases, trims, and collapses whitespace', () => {
    const n = normalizeQuestion('  Best   COLLEGE  for   CSE?  ')
    expect(n.normalized).toBe('best college for cse')
    expect(n.tokens).toEqual(['best', 'college', 'for', 'cse'])
  })

  it('preserves &, /, and decimal points', () => {
    expect(normalizeQuestion('AI&DS cutoff 195.5').normalized).toBe('ai&ds cutoff 195.5')
    expect(normalizeQuestion('psg v/s anna').normalized).toBe('psg v/s anna')
  })

  it('strips sentence punctuation but keeps decimals intact', () => {
    const n = normalizeQuestion('What are placements at PSG?')
    expect(n.normalized).toBe('what are placements at psg')
    expect(normalizeQuestion('I scored 189.5 marks.').tokens).toContain('189.5')
  })

  it('applies the common-typo map token by token', () => {
    expect(normalizeQuestion('placemnt at psg collage').normalized).toBe('placement at psg college')
    expect(normalizeQuestion('recomend a good colledge').normalized).toBe('recommend a good college')
  })

  it('handles empty and whitespace-only input', () => {
    expect(normalizeQuestion('').normalized).toBe('')
    expect(normalizeQuestion('   ').tokens).toEqual([])
  })

  it('is deterministic', () => {
    const a = normalizeQuestion('Compare PSG and Anna University')
    const b = normalizeQuestion('Compare PSG and Anna University')
    expect(a).toEqual(b)
  })
})
