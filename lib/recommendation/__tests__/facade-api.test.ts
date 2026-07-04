/**
 * @module lib/recommendation/__tests__/facade-api.test
 *
 * Full public-API surface of the Recommendation Facade (Module 7). Asserts that
 * every documented method exists, returns a well-formed ranking with the correct
 * category, and — for the dimension/ownership methods — filters and orders as
 * specified. Complements facade.test.ts (eligibility bands + wiring).
 */

import { describe, expect, it } from 'vitest'
import type { RecommendationResult } from '@/lib/recommendation'
import { makeHarness, NAME, OC } from './support'

const { reco } = makeHarness()

/** Ranks contiguous from 1 and non-increasing in total score. */
function wellFormed(results: readonly RecommendationResult[]): void {
  results.forEach((r, i) => expect(r.rank).toBe(i + 1))
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1].score.total).toBeGreaterThanOrEqual(results[i].score.total)
  }
}

describe('facade — complete public API surface', () => {
  it('exposes all sixteen public methods as callables', () => {
    const methods = [
      'recommend',
      'recommendBestCollege',
      'recommendBestPlacement',
      'recommendBestFaculty',
      'recommendBestResearch',
      'recommendBestInfrastructure',
      'recommendBestROI',
      'recommendGovernmentColleges',
      'recommendPrivateColleges',
      'recommendByBranch',
      'recommendByCutoff',
      'recommendSafeColleges',
      'recommendTargetColleges',
      'recommendReachColleges',
      'recommendDreamColleges',
      'compareColleges',
    ] as const
    for (const m of methods) {
      expect(typeof (reco as unknown as Record<string, unknown>)[m]).toBe('function')
    }
  })

  it('every ranking method returns a well-formed, correctly-tagged ranking', () => {
    const cases: [ReturnType<typeof reco.recommendBestCollege>, string][] = [
      [reco.recommendBestCollege({ limit: 3 }), 'best_overall'],
      [reco.recommendBestPlacement({ limit: 3 }), 'best_placement'],
      [reco.recommendBestFaculty({ limit: 3 }), 'best_faculty'],
      [reco.recommendBestResearch({ limit: 3 }), 'best_research'],
      [reco.recommendBestInfrastructure({ limit: 3 }), 'best_infrastructure'],
      [reco.recommendBestROI({ limit: 3 }), 'best_roi'],
      [reco.recommendGovernmentColleges({ limit: 3 }), 'government_college'],
      [reco.recommendPrivateColleges({ limit: 3 }), 'private_college'],
      [reco.recommendByBranch('Computer Science and Engineering', { limit: 3 }), 'by_branch'],
      [reco.recommendByCutoff(195, OC, { limit: 3 }), 'by_cutoff'],
    ]
    for (const [results, category] of cases) {
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) expect(r.category).toBe(category)
      wellFormed(results)
    }
  })

  // ── The five methods added to complete the facade ──────────────────────────

  it('recommendBestFaculty ranks the faculty-strongest college and requires faculty data', () => {
    const results = reco.recommendBestFaculty({ limit: 10 })
    expect(results[0].college.name).toBe(NAME.alpha)
    expect(results.map((r) => r.college.name)).not.toContain(NAME.gamma)
    for (const r of results) {
      expect(r.score.dimensions.find((d) => d.dimension === 'faculty')!.hasData).toBe(true)
    }
  })

  it('recommendBestResearch ranks the research-strongest college and requires research data', () => {
    const results = reco.recommendBestResearch({ limit: 10 })
    expect(results[0].college.name).toBe(NAME.alpha)
    for (const r of results) {
      expect(r.score.dimensions.find((d) => d.dimension === 'research')!.hasData).toBe(true)
    }
  })

  it('recommendBestInfrastructure ranks the infrastructure-strongest college', () => {
    const results = reco.recommendBestInfrastructure({ limit: 10 })
    expect(results[0].college.name).toBe(NAME.alpha)
    for (const r of results) {
      expect(r.score.dimensions.find((d) => d.dimension === 'infrastructure')!.hasData).toBe(true)
    }
  })

  it('recommendGovernmentColleges returns only government-classified colleges', () => {
    const names = reco.recommendGovernmentColleges().map((r) => r.college.name)
    expect(names).toEqual([NAME.govt])
  })

  it('recommendPrivateColleges excludes government-classified colleges', () => {
    const names = reco.recommendPrivateColleges().map((r) => r.college.name)
    expect(names).toContain(NAME.alpha)
    expect(names).toContain(NAME.beta)
    expect(names).not.toContain(NAME.govt)
  })

  // ── Generic dispatch still reaches the two non-dedicated categories ─────────

  it('reaches higher_studies and government_jobs via generic recommend()', () => {
    for (const category of ['higher_studies', 'government_jobs'] as const) {
      const results = reco.recommend({ category, limit: 3 })
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) expect(r.category).toBe(category)
    }
  })

  it('honours the limit uniformly across methods', () => {
    expect(reco.recommendBestFaculty({ limit: 2 })).toHaveLength(2)
    expect(reco.recommendBestResearch({ limit: 1 })).toHaveLength(1)
    expect(reco.recommendPrivateColleges({ limit: 2 })).toHaveLength(2)
  })

  it('produces identical output across repeated calls (determinism)', () => {
    const a = reco.recommendBestFaculty({ limit: 10 }).map((r) => [r.college.id, r.score.total])
    const b = reco.recommendBestFaculty({ limit: 10 }).map((r) => [r.college.id, r.score.total])
    expect(a).toEqual(b)
  })
})
