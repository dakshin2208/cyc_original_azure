/**
 * @module lib/ai/orchestration/__tests__/entity-extractor.test
 * EntityExtractor — numbers, community, branch, category, location, colleges.
 */

import { describe, expect, it } from 'vitest'
import { createEntityExtractor, normalizeQuestion, type EntityType } from '@/lib/ai/orchestration'
import { EMPTY_LEXICON, makeHarness, NAME } from './support'

const extractor = createEntityExtractor(EMPTY_LEXICON)
const run = (q: string) => {
  const n = normalizeQuestion(q)
  return extractor.extract(n.normalized, n.tokens)
}
const typesOf = (q: string): EntityType[] => run(q).entities.map((e) => e.type)

describe('entity extractor — numbers, community, branch (no warehouse)', () => {
  it('classifies a decimal in the cutoff band as a cutoff', () => {
    const out = run('cutoff 195.5 for cse')
    expect(out.studentCutoff).toBe(195.5)
    expect(typesOf('cutoff 195.5 for cse')).toContain('cutoff')
  })

  it('classifies "nirf rank 5" as a NIRF rank, not a cutoff', () => {
    expect(typesOf('nirf rank 5')).toContain('nirf_rank')
    expect(run('nirf rank 5').studentCutoff).toBeNull()
  })

  it('classifies fee and package numbers by keyword context', () => {
    expect(typesOf('what is the fee 200000')).toContain('fees')
    expect(typesOf('package of 12 lpa')).toContain('placements')
  })

  it('does not treat a "top N" count as a cutoff', () => {
    expect(run('top 5 colleges').studentCutoff).toBeNull()
  })

  it('extracts community, requiring context for the ambiguous SC/ST codes', () => {
    expect(run('i am in BC with cutoff 180').community).toBe('BC')
    expect(run('sc community cutoff 150').community).toBe('SC') // context word present
    expect(run('st xaviers college').community).toBeNull() // bare "st" ignored
  })

  it('normalizes branch aliases to canonical names', () => {
    expect(run('best college for cse').branch).toBe('Computer Science and Engineering')
    expect(run('mechanical engineering placements').branch).toBe('Mechanical Engineering')
    expect(run('ece cutoff').branch).toBe('Electronics and Communication Engineering')
  })

  it('detects the government/private category', () => {
    expect(typesOf('recommend a government college')).toContain('category')
    expect(run('best private college').entities.find((e) => e.type === 'category')?.value).toBe('private')
  })

  it('never resolves a college without a distinctive token', () => {
    expect(run('best college for cse').colleges).toHaveLength(0)
    expect(run('recommend a government college').colleges).toHaveLength(0)
  })
})

describe('entity extractor — college & location resolution (warehouse)', () => {
  const { lexicon } = makeHarness()
  const ex = createEntityExtractor(lexicon)
  const r = (q: string) => {
    const n = normalizeQuestion(q)
    return ex.extract(n.normalized, n.tokens)
  }

  it('resolves a single named college (with misspelling)', () => {
    expect(r('placements at psg college of technology').colleges.map((c) => c.name)).toContain(NAME.psg)
    expect(r('placemnt at psg collage').colleges.map((c) => c.name)).toContain(NAME.psg)
  })

  it('resolves multiple colleges in a comparison', () => {
    const out = r('compare psg college of technology and anna university')
    const names = out.colleges.map((c) => c.name)
    expect(names).toContain(NAME.psg)
    expect(names).toContain(NAME.anna)
    expect(out.colleges.length).toBeGreaterThanOrEqual(2)
  })

  it('detects a known location', () => {
    expect(r('colleges in coimbatore').location).toBe('coimbatore')
  })
})
