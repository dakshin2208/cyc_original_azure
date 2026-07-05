/**
 * @module lib/ai/orchestration/__tests__/query-parser.test
 * QueryParser — end-to-end normalization + extraction + intent on the fixture.
 */

import { describe, expect, it } from 'vitest'
import { createQueryParser } from '@/lib/ai/orchestration'
import { makeHarness, NAME } from './support'

const { lexicon } = makeHarness()
const parser = createQueryParser(lexicon)

describe('query parser', () => {
  it('produces a complete ParsedQuery for a recommendation question', () => {
    const p = parser.parse('Which is the best college for CSE?')
    expect(p.intent).toBe('recommend_college')
    expect(p.branch).toBe('Computer Science and Engineering')
    expect(p.colleges).toHaveLength(0)
    expect(p.raw).toBe('Which is the best college for CSE?')
    expect(p.normalized).toBe('which is the best college for cse')
  })

  it('parses a full eligibility question', () => {
    const p = parser.parse('Can I get into Anna University with 195 cutoff in BC?')
    expect(p.intent).toBe('eligibility_query')
    expect(p.studentCutoff).toBe(195)
    expect(p.community).toBe('BC')
    expect(p.colleges).toContain(NAME.anna)
  })

  it('flags multiple colleges for comparison', () => {
    const p = parser.parse('compare PSG College of Technology and Anna University')
    expect(p.intent).toBe('compare_colleges')
    expect(p.hasMultipleColleges).toBe(true)
    expect(p.colleges).toEqual(expect.arrayContaining([NAME.psg, NAME.anna]))
  })

  it('handles misspellings via the typo map + fuzzy resolver', () => {
    const p = parser.parse('placemnt at psg collage')
    expect(p.intent).toBe('placement_query')
    expect(p.colleges).toContain(NAME.psg)
  })

  it('marks unrecognized input as unknown with low confidence', () => {
    const p = parser.parse('asdf qwer zxcv')
    expect(p.intent).toBe('unknown')
    expect(p.intentConfidence).toBeLessThan(0.5)
    expect(p.entities).toHaveLength(0)
  })

  it('is deterministic', () => {
    const a = parser.parse('compare psg and anna university')
    const b = parser.parse('compare psg and anna university')
    expect(a).toEqual(b)
  })
})
