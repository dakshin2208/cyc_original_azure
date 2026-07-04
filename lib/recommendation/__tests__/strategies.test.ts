/**
 * @module lib/recommendation/__tests__/strategies.test
 * Recommendation Strategies (Module 4): ranking, filters, reasoning, confidence.
 */

import { describe, expect, it } from 'vitest'
import type { RecommendationCategory, RecommendationResult } from '@/lib/recommendation'
import { makeHarness, NAME } from './support'

const { reco } = makeHarness()

/** Ranks must be contiguous 1..n and strictly non-increasing in score. */
function assertWellFormedRanking(results: readonly RecommendationResult[]): void {
  results.forEach((r, i) => expect(r.rank).toBe(i + 1))
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1].score.total).toBeGreaterThanOrEqual(results[i].score.total)
  }
}

describe('strategies', () => {
  it('best-overall ranks the strongest college first and is well-formed', () => {
    const results = reco.recommendBestCollege()
    expect(results[0].college.name).toBe(NAME.alpha)
    assertWellFormedRanking(results)
  })

  it('best-placement puts the top-placement college first', () => {
    const results = reco.recommendBestPlacement()
    expect(results[0].college.name).toBe(NAME.alpha)
    expect(results[0].category).toBe('best_placement')
  })

  it('best-placement never ranks a college that has no placement data (regression)', () => {
    const results = reco.recommendBestPlacement({ limit: 10 })
    // Master-only colleges lack placement data and must be excluded.
    const names = results.map((r) => r.college.name)
    expect(names).not.toContain(NAME.gamma)
    expect(names).not.toContain(NAME.delta)
    // Every ranked college has placement data backing the axis it is ranked on.
    for (const r of results) {
      const placement = r.score.dimensions.find((d) => d.dimension === 'placement')!
      expect(placement.hasData).toBe(true)
    }
  })

  it('private-college filter excludes government-classified colleges', () => {
    const names = reco.recommend({ category: 'private_college' }).map((r) => r.college.name)
    expect(names).toContain(NAME.alpha)
    expect(names).toContain(NAME.beta)
    expect(names).not.toContain(NAME.govt)
  })

  it('government-college filter returns only government-classified colleges', () => {
    const names = reco.recommend({ category: 'government_college' }).map((r) => r.college.name)
    expect(names).toEqual([NAME.govt])
  })

  it('best-ROI attaches the honest "fees unavailable" caveat', () => {
    const results = reco.recommendBestROI()
    expect(results[0].notes.join(' ')).toMatch(/fees are not present/i)
  })

  it('every result carries structured reasons + evidence + confidence (no prose)', () => {
    const top = reco.recommendBestCollege({ limit: 1 })[0]
    expect(top.explanation.reasons.length).toBeGreaterThan(0)
    for (const reason of top.explanation.reasons) {
      expect(['strong', 'moderate', 'weak']).toContain(reason.strength)
      expect(Array.isArray(reason.evidence)).toBe(true)
      for (const e of reason.evidence) {
        expect(typeof e.label).toBe('string')
        expect(typeof e.source).toBe('string')
      }
    }
    expect(top.confidence.value).toBeGreaterThanOrEqual(0)
    expect(top.confidence.value).toBeLessThanOrEqual(1)
  })

  it('confidence tracks data completeness (high for full data, low for sparse)', () => {
    const all = reco.recommendBestCollege({ limit: 10 })
    const alpha = all.find((r) => r.college.name === NAME.alpha)!
    const delta = all.find((r) => r.college.name === NAME.delta)!
    expect(alpha.confidence.level).toBe('high')
    expect(delta.confidence.level).toBe('low')
  })

  it('respects the result limit', () => {
    expect(reco.recommendBestCollege({ limit: 2 })).toHaveLength(2)
    expect(reco.recommendBestCollege({ limit: 0 })).toHaveLength(0)
  })

  it('breaks score ties deterministically by name (regression)', () => {
    const results = reco.recommendBestCollege({ limit: 10 })
    // Delta and Gamma both have zero data-driven score; Delta sorts before Gamma.
    const tail = results.slice(-2).map((r) => r.college.name)
    expect(tail).toEqual([NAME.delta, NAME.gamma])
  })

  it('produces identical output across repeated calls (determinism)', () => {
    const a = reco.recommendBestCollege({ limit: 10 })
    const b = reco.recommendBestCollege({ limit: 10 })
    expect(a.map((r) => r.college.id)).toEqual(b.map((r) => r.college.id))
    expect(a.map((r) => r.score.total)).toEqual(b.map((r) => r.score.total))
  })

  it('exposes all ten core strategies via generic dispatch', () => {
    const categories: RecommendationCategory[] = [
      'best_overall', 'best_placement', 'best_research', 'best_faculty', 'best_infrastructure',
      'best_roi', 'higher_studies', 'government_jobs', 'private_college', 'government_college',
    ]
    for (const category of categories) {
      const results = reco.recommend({ category, limit: 3 })
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) expect(r.category).toBe(category)
      assertWellFormedRanking(results)
    }
  })
})
