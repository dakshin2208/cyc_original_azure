/**
 * @module lib/recommendation/__tests__/config.test
 * Configuration: defaults, emphasis, and deep-merge overrides (Module 8).
 */

import { describe, expect, it } from 'vitest'
import { defaultConfig, resolveConfig, SCORE_DIMENSIONS } from '@/lib/recommendation'

describe('config', () => {
  it('exposes a weight for every scoring dimension', () => {
    for (const d of SCORE_DIMENSIONS) {
      expect(typeof defaultConfig.weights[d]).toBe('number')
    }
  })

  it('emphasises placement in the best_placement profile', () => {
    expect(defaultConfig.strategyWeights.best_placement.placement).toBe(
      defaultConfig.weights.placement * 3,
    )
    // Non-emphasised dimensions are unchanged.
    expect(defaultConfig.strategyWeights.best_placement.faculty).toBe(defaultConfig.weights.faculty)
  })

  it('defines a weight profile for every category', () => {
    const categories = [
      'best_overall', 'best_placement', 'best_research', 'best_faculty', 'best_infrastructure',
      'best_roi', 'higher_studies', 'government_jobs', 'private_college', 'government_college',
      'by_branch', 'by_cutoff',
    ]
    for (const c of categories) expect(defaultConfig.strategyWeights[c]).toBeDefined()
  })

  it('resolveConfig() returns defaults when no override is given', () => {
    expect(resolveConfig()).toBe(defaultConfig)
  })

  it('deep-merges a partial override without mutating defaults', () => {
    const merged = resolveConfig({
      eligibility: { safeMargin: 12 },
      confidence: { highThreshold: 0.9 },
      defaultLimit: 3,
    })
    expect(merged.eligibility.safeMargin).toBe(12)
    // Untouched sibling keeps its default.
    expect(merged.eligibility.reachMargin).toBe(defaultConfig.eligibility.reachMargin)
    expect(merged.confidence.highThreshold).toBe(0.9)
    expect(merged.defaultLimit).toBe(3)
    // Defaults are untouched.
    expect(defaultConfig.eligibility.safeMargin).toBe(8)
  })

  it('merges custom strategy weights over the defaults', () => {
    const merged = resolveConfig({
      strategyWeights: { best_overall: { ...defaultConfig.weights, placement: 99 } },
    })
    expect(merged.strategyWeights.best_overall.placement).toBe(99)
    // Other profiles remain.
    expect(merged.strategyWeights.best_placement).toEqual(defaultConfig.strategyWeights.best_placement)
  })
})
