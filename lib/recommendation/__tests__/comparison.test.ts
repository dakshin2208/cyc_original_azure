/**
 * @module lib/recommendation/__tests__/comparison.test
 * College Comparison Engine (Module 5): winner, dimension winners, strengths.
 */

import { describe, expect, it } from 'vitest'
import { SCORE_DIMENSIONS } from '@/lib/recommendation'
import { makeHarness, NAME } from './support'

const { reco } = makeHarness()

describe('comparison engine', () => {
  it('compares two colleges and names the stronger as winner', () => {
    const result = reco.compareColleges([NAME.alpha, NAME.beta])
    expect(result.colleges).toHaveLength(2)
    expect(result.winner?.name).toBe(NAME.alpha)
    expect(result.scores).toHaveLength(2)
  })

  it('reports a winner for each scored dimension (category winners)', () => {
    const result = reco.compareColleges([NAME.alpha, NAME.beta])
    expect(result.categoryWinners).toHaveLength(SCORE_DIMENSIONS.length)
    // Alpha out-performs Beta on placement.
    const placement = result.dimensions.find((d) => d.dimension === 'placement')!
    expect(placement.winner?.name).toBe(NAME.alpha)
    // No per-college branch data → nobody wins availableBranches.
    const branches = result.dimensions.find((d) => d.dimension === 'availableBranches')!
    expect(branches.winner).toBeNull()
  })

  it('derives per-college strengths and weaknesses', () => {
    const result = reco.compareColleges([NAME.alpha, NAME.beta])
    const alpha = result.profiles.find((p) => p.college.name === NAME.alpha)!
    const beta = result.profiles.find((p) => p.college.name === NAME.beta)!
    // Alpha dominates placement → it is a strength for Alpha and a weakness for Beta.
    expect(alpha.strengths).toContain('placement')
    expect(beta.weaknesses).toContain('placement')
  })

  it('supports comparing more than two colleges', () => {
    const result = reco.compareColleges([NAME.alpha, NAME.beta, NAME.govt])
    expect(result.colleges).toHaveLength(3)
    expect(result.winner?.name).toBe(NAME.alpha)
    for (const d of result.dimensions) expect(d.values).toHaveLength(3)
  })

  it('returns no winner on a genuine tie', () => {
    // Two master-only colleges score identically (zero data-driven signal).
    const result = reco.compareColleges([NAME.gamma, NAME.delta])
    expect(result.winner).toBeNull()
  })

  it('is deterministic across repeated comparisons', () => {
    const a = reco.compareColleges([NAME.alpha, NAME.beta, NAME.govt])
    const b = reco.compareColleges([NAME.alpha, NAME.beta, NAME.govt])
    expect(a.scores.map((s) => s.score.total)).toEqual(b.scores.map((s) => s.score.total))
    expect(a.categoryWinners.map((c) => c.winner?.name ?? null)).toEqual(
      b.categoryWinners.map((c) => c.winner?.name ?? null),
    )
  })
})
