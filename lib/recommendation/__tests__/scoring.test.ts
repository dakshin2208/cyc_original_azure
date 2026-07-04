/**
 * @module lib/recommendation/__tests__/scoring.test
 * College Scoring Engine (Module 2): dimensions, renormalization, weights, ties.
 */

import { describe, expect, it } from 'vitest'
import {
  createScoringEngine,
  defaultConfig,
  resolveConfig,
  SCORE_DIMENSIONS,
  type ScoreDimension,
} from '@/lib/recommendation'
import { college, makeHarness, NAME } from './support'

const scoring = createScoringEngine(resolveConfig())

function dim(dims: readonly { dimension: ScoreDimension; normalized: number; hasData: boolean; contribution: number }[], d: ScoreDimension) {
  return dims.find((x) => x.dimension === d)!
}

describe('scoring engine', () => {
  const { repos, reco } = makeHarness()
  const alpha = reco.profiles.getProfile(college(repos, NAME.alpha))
  const delta = reco.profiles.getProfile(college(repos, NAME.delta))

  it('computes each dimension independently from its own raw metrics', () => {
    const s = scoring.score(alpha, defaultConfig.weights)
    // placement = blend(salary 1.2M/1.2M = 1.0, rate 950/1000 = 0.95) = 0.975
    expect(dim(s.dimensions, 'placement').normalized).toBeCloseTo(0.975, 6)
    // academic reputation = (300 + 100) / 500 = 0.8
    expect(dim(s.dimensions, 'academicReputation').normalized).toBeCloseTo(0.8, 6)
    // NIRF presence is a known binary signal.
    expect(dim(s.dimensions, 'nirfPresence').normalized).toBe(1)
    // data completeness dimension = 5/5 fact facets present.
    expect(dim(s.dimensions, 'dataCompleteness').normalized).toBe(1)
  })

  it('emits every configured dimension with its weight', () => {
    const s = scoring.score(alpha, defaultConfig.weights)
    expect(s.dimensions.map((d) => d.dimension)).toEqual([...SCORE_DIMENSIONS])
    for (const d of s.dimensions) expect(d.weight).toBe(defaultConfig.weights[d.dimension])
  })

  it('keeps the total within [0, 1]', () => {
    for (const name of Object.values(NAME)) {
      const s = scoring.score(reco.profiles.getProfile(college(repos, name)), defaultConfig.weights)
      expect(s.total).toBeGreaterThanOrEqual(0)
      expect(s.total).toBeLessThanOrEqual(1)
    }
  })

  it('omits a missing dimension from the numerator but keeps its weight (fixed denominator)', () => {
    const s = scoring.score(delta, defaultConfig.weights)
    // Master-only college: placement/faculty/research/finance/reputation absent → 0 contribution.
    for (const d of ['placement', 'faculty', 'research', 'infrastructure', 'financialStrength', 'academicReputation'] as ScoreDimension[]) {
      expect(dim(s.dimensions, d).hasData).toBe(false)
      expect(dim(s.dimensions, d).contribution).toBe(0)
    }
    // Only always-known signals carry data; both are zero-valued here → total 0.
    expect(dim(s.dimensions, 'nirfPresence').hasData).toBe(true)
    expect(dim(s.dimensions, 'dataCompleteness').hasData).toBe(true)
    expect(s.total).toBe(0)
  })

  it('treats availableBranches as unbacked (no per-college branch linkage)', () => {
    const s = scoring.score(alpha, defaultConfig.weights)
    expect(dim(s.dimensions, 'availableBranches').hasData).toBe(false)
    expect(dim(s.dimensions, 'availableBranches').contribution).toBe(0)
  })

  it('reports data completeness as a fraction of dimensions with data', () => {
    // 8 of 10 dimensions have data for a full college (availableBranches + selectivity absent in the fixture).
    expect(scoring.score(alpha, defaultConfig.weights).dataCompleteness).toBeCloseTo(8 / 10, 6)
    // 2 of 10 for a master-only college (nirfPresence + dataCompleteness).
    expect(scoring.score(delta, defaultConfig.weights).dataCompleteness).toBeCloseTo(2 / 10, 6)
  })

  it('responds to the weight profile (placement emphasis raises a placement-strong college)', () => {
    const base = scoring.score(alpha, defaultConfig.weights).total
    const placementWeighted = scoring.score(alpha, defaultConfig.strategyWeights.best_placement).total
    // Alpha's placement (0.975) is above its overall average, so emphasising it lifts the total.
    expect(placementWeighted).toBeGreaterThan(base)
  })

  it('is deterministic — identical inputs yield identical totals', () => {
    const a = scoring.score(alpha, defaultConfig.weights)
    const b = scoring.score(alpha, defaultConfig.weights)
    expect(a.total).toBe(b.total)
    expect(a.dimensions).toEqual(b.dimensions)
  })
})
