/**
 * @module lib/recommendation/__tests__/explanations.test
 *
 * Reason Generator (Module 6): confidence banding + STRUCTURED explanations.
 * Confidence banding is unit-tested at its boundaries with synthetic scores;
 * explanation structure is asserted end-to-end over the fixture engine.
 */

import { describe, expect, it } from 'vitest'
import {
  createReasonGenerator,
  resolveConfig,
  SCORE_DIMENSIONS,
  type RecommendationScore,
  type ReasonStrength,
  type ScoreDimension,
} from '@/lib/recommendation'
import { makeHarness, NAME } from './support'

const reasons = createReasonGenerator(resolveConfig()) // high≥0.75, medium≥0.45

/** A synthetic score with a chosen completeness and a chosen #dimensions-with-data. */
function fakeScore(dataCompleteness: number, withData: number): RecommendationScore {
  const dimensions = SCORE_DIMENSIONS.map((dimension, i) => ({
    dimension,
    raw: null,
    normalized: 0,
    weight: 1,
    contribution: 0,
    hasData: i < withData,
  }))
  return { total: 0, dimensions, dataCompleteness }
}

describe('confidence generation', () => {
  it('bands by data completeness at the configured thresholds', () => {
    expect(reasons.confidence(fakeScore(0.75, 7)).level).toBe('high') // ≥ high
    expect(reasons.confidence(fakeScore(0.6, 6)).level).toBe('medium')
    expect(reasons.confidence(fakeScore(0.45, 4)).level).toBe('medium') // = medium boundary
    expect(reasons.confidence(fakeScore(0.44, 4)).level).toBe('low')
  })

  it('reports value and a machine-readable basis', () => {
    const c = reasons.confidence(fakeScore(0.5, 4))
    expect(c.value).toBe(0.5)
    expect(c.dataCompleteness).toBe(0.5)
    expect(c.basis).toBe('data_completeness=4/10')
    expect(c.value).toBeGreaterThanOrEqual(0)
    expect(c.value).toBeLessThanOrEqual(1)
  })

  it('tracks real profiles — full data ⇒ high, sparse ⇒ low', () => {
    const { reco } = makeHarness()
    const all = reco.recommendBestCollege({ limit: 10 })
    expect(all.find((r) => r.college.name === NAME.alpha)!.confidence.level).toBe('high')
    expect(all.find((r) => r.college.name === NAME.delta)!.confidence.level).toBe('low')
  })
})

describe('recommendation explanations (structured, not prose)', () => {
  const { reco } = makeHarness()
  const top = reco.recommendBestCollege({ limit: 1 })[0]

  it('carries a category headline and at least one reason', () => {
    expect(top.explanation.headline).toBe('Best overall fit')
    expect(top.explanation.reasons.length).toBeGreaterThan(0)
  })

  it('emits structured reasons — dimension, strength, short label, evidence', () => {
    const strengths: ReasonStrength[] = ['strong', 'moderate', 'weak']
    for (const reason of top.explanation.reasons) {
      expect(SCORE_DIMENSIONS).toContain(reason.dimension as ScoreDimension)
      expect(strengths).toContain(reason.strength)
      // A short structured LABEL, not a sentence/paragraph.
      expect(reason.summary.length).toBeLessThan(60)
      expect(reason.summary).not.toMatch(/\.\s/)
      expect(Array.isArray(reason.evidence)).toBe(true)
    }
  })

  it('backs reasons with concrete warehouse evidence', () => {
    const placement = top.explanation.reasons.find((r) => r.dimension === 'placement')
    // Alpha has placement data, so if placement is a reason it must cite real values.
    if (placement) {
      const values = placement.evidence.map((e) => e.value)
      expect(values.some((v) => typeof v === 'number')).toBe(true)
      for (const e of placement.evidence) {
        expect(typeof e.label).toBe('string')
        expect(typeof e.source).toBe('string')
      }
    }
  })

  it('orders reasons by descending contribution (highest-impact first)', () => {
    const byDim = new Map(top.score.dimensions.map((d) => [d.dimension, d.contribution]))
    const contributions = top.explanation.reasons.map((r) => byDim.get(r.dimension) ?? 0)
    for (let i = 1; i < contributions.length; i++) {
      expect(contributions[i - 1]).toBeGreaterThanOrEqual(contributions[i])
    }
  })

  it('embeds the same confidence object surfaced on the result', () => {
    expect(top.explanation.confidence).toEqual(top.confidence)
  })
})
