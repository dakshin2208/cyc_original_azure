/**
 * @module lib/recommendation/__tests__/facade.test
 * Recommendation Facade (Module 7): intent methods, eligibility bands, wiring.
 */

import { describe, expect, it } from 'vitest'
import { createTableCutoffLookup } from '@/lib/recommendation'
import { college, makeHarness, NAME, OC } from './support'

// Ids are deterministic (name-derived), so a table built from one harness applies
// to another built from the same fixture.
const base = makeHarness()
const id = (name: string): string => college(base.repos, name).id

const cutoffs = createTableCutoffLookup([
  { collegeId: id(NAME.beta), community: 'OC', closingCutoff: 180 }, // 195 → +15 → safe
  { collegeId: id(NAME.alpha), community: 'OC', closingCutoff: 190 }, // 195 → +5  → target
  { collegeId: id(NAME.govt), community: 'OC', closingCutoff: 197 }, // 195 → -2  → reach
  { collegeId: id(NAME.gamma), community: 'OC', closingCutoff: 210 }, // 195 → -15 → dream
])

describe('facade wiring', () => {
  it('exposes the resolved config and the profile provider', () => {
    const h = makeHarness()
    expect(h.reco.config.defaultLimit).toBe(10)
    expect(h.reco.profiles.getByExactName(NAME.alpha)?.college.name).toBe(NAME.alpha)
  })

  it('recommendBestCollege / Placement / ROI return ranked results', () => {
    const h = makeHarness()
    expect(h.reco.recommendBestCollege({ limit: 1 })[0].college.name).toBe(NAME.alpha)
    expect(h.reco.recommendBestPlacement({ limit: 1 })[0].category).toBe('best_placement')
    expect(h.reco.recommendBestROI({ limit: 1 })[0].category).toBe('best_roi')
  })

  it('recommendByBranch ranks colleges and notes the branch-data limitation', () => {
    const h = makeHarness()
    const results = h.reco.recommendByBranch('Computer Science and Engineering', { limit: 3 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].notes.join(' ')).toMatch(/colleges that offer this branch are preferred/i)
  })
})

describe('facade eligibility bands (with injected cutoffs)', () => {
  const { reco } = makeHarness({ cutoffs })

  it('annotates eligibility on every by-cutoff result', () => {
    const results = reco.recommendByCutoff(195, OC)
    const alpha = results.find((r) => r.college.name === NAME.alpha)!
    expect(alpha.eligibility?.category).toBe('target')
    // Colleges absent from the table degrade to unknown, not an error.
    const delta = results.find((r) => r.college.name === NAME.delta)!
    expect(delta.eligibility?.category).toBe('unknown')
  })

  it('filters to the requested eligibility band', () => {
    expect(reco.recommendSafeColleges(195, OC).map((r) => r.college.name)).toEqual([NAME.beta])
    expect(reco.recommendTargetColleges(195, OC).map((r) => r.college.name)).toEqual([NAME.alpha])
    expect(reco.recommendReachColleges(195, OC).map((r) => r.college.name)).toEqual([NAME.govt])
    expect(reco.recommendDreamColleges(195, OC).map((r) => r.college.name)).toEqual([NAME.gamma])
  })

  it('re-numbers ranks contiguously after band filtering', () => {
    const safe = reco.recommendSafeColleges(195, OC)
    safe.forEach((r, i) => expect(r.rank).toBe(i + 1))
  })
})

describe('facade without cutoff data', () => {
  const { reco } = makeHarness()

  it('returns no banded colleges when cutoffs are unavailable (honest empty)', () => {
    expect(reco.recommendSafeColleges(195, OC)).toHaveLength(0)
    expect(reco.recommendDreamColleges(195, OC)).toHaveLength(0)
    // But the underlying ranking still works, annotated unknown.
    const byCutoff = reco.recommendByCutoff(195, OC)
    expect(byCutoff.length).toBeGreaterThan(0)
    expect(byCutoff.every((r) => r.eligibility?.category === 'unknown')).toBe(true)
  })
})

describe('facade comparison by name', () => {
  const { reco } = makeHarness()

  it('resolves names and ignores unresolved entries', () => {
    const result = reco.compareColleges([NAME.alpha, 'Nonexistent Institute XYZ'])
    expect(result.colleges).toHaveLength(1)
    expect(result.winner?.name).toBe(NAME.alpha)
  })
})
