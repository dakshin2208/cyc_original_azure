/**
 * @module lib/ai/orchestration/__tests__/entity-extractor.test
 * EntityExtractor — numbers, community, branch, category, location, colleges.
 */

import { describe, expect, it } from 'vitest'
import { createEntityExtractor, normalizeQuestion, type EntityType, type QueryLexicon } from '@/lib/ai/orchestration'
import type { CanonicalCollege, CanonicalCollegeId, CounsellingCode, NirfId } from '@/lib/knowledge'
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

// RC1 regression — a district must NEVER be resolved as a college. Uses a custom
// lexicon that mimics the real fuzzy matcher (where "coimbatore" resolves to a
// college whose name starts with that district), so the bug is reproduced without
// the full warehouse. Without the Phase-1 fix, the first two tests below fail.
describe('entity extractor — RC1: a location is not a college', () => {
  const mkCol = (name: string, city: string): CanonicalCollege => ({
    id: `col:${name.toLowerCase().replace(/\W+/g, '-')}` as CanonicalCollegeId,
    name,
    nameSlug: name.toLowerCase().replace(/\W+/g, '-'),
    city,
    state: 'Tamil Nadu',
    nirfId: null as NirfId | null,
    counsellingCodes: [] as readonly CounsellingCode[],
    hasNirfData: false,
  })
  const CIT = mkCol('Coimbatore Institute of Technology', 'Coimbatore')
  const PSG = mkCol('PSG College of Technology', 'Coimbatore')
  const HOLYCROSS = mkCol('Holycross Engineering College', 'Trichy')
  const lexicon: QueryLexicon = {
    locations: new Set(['coimbatore', 'chennai', 'madurai', 'salem']),
    resolveColleges: (frag: string) => {
      const f = frag.toLowerCase()
      if (f.includes('coimbatore')) return [{ college: CIT, score: 0.85 }]
      if (f.includes('psg')) return [{ college: PSG, score: 0.95 }]
      if (f.includes('hogwarts')) return [{ college: HOLYCROSS, score: 0.7 }] // spurious fuzzy match
      return []
    },
  }
  const ex = createEntityExtractor(lexicon)
  const r = (q: string) => {
    const n = normalizeQuestion(q)
    return ex.extract(n.normalized, n.tokens)
  }

  it('does NOT resolve a college from a bare "in <district>" filter', () => {
    const out = r('cse in coimbatore')
    expect(out.colleges).toHaveLength(0) // RC1: was ["Coimbatore Institute of Technology"]
    expect(out.location).toBe('coimbatore') // still detected as a location
  })

  it('does NOT resolve a college for the flagship / district-only queries', () => {
    expect(r('cse in coimbatore with bc 190').colleges).toHaveLength(0)
    expect(r('colleges in madurai').colleges).toHaveLength(0)
  })

  it('STILL resolves a college when a location is followed by an institution word', () => {
    expect(r('coimbatore institute of technology').colleges.map((c) => c.name)).toContain(
      'Coimbatore Institute of Technology',
    )
  })

  it('STILL resolves a distinctive (non-location) college name', () => {
    expect(r('placements at psg college of technology').colleges.map((c) => c.name)).toContain(
      'PSG College of Technology',
    )
  })

  it('RC7: rejects a fuzzy match that does not reflect the distinctive token', () => {
    const out = r('hogwarts engineering college')
    expect(out.colleges).toHaveLength(0) // the Holycross fuzzy match is rejected
    expect(out.unverifiedCollege).toBe(true) // flagged for a "couldn't verify" decline
  })

  it('RC7: a resolved college is not flagged as unverified', () => {
    expect(r('psg college of technology').unverifiedCollege).toBe(false)
  })
})
