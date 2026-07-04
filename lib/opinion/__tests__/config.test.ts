/**
 * @module lib/opinion/__tests__/config.test
 * Opinion configuration — defaults, override merge, substantive-dimension set.
 */

import { describe, expect, it } from 'vitest'
import { PRIORITIES, defaultOpinionConfig, resolveOpinionConfig, SUBSTANTIVE_DIMENSIONS } from '@/lib/opinion'

describe('opinion config', () => {
  it('maps every priority to a dimension (or null)', () => {
    for (const p of PRIORITIES) expect(p in defaultOpinionConfig.priorityDimension).toBe(true)
    expect(defaultOpinionConfig.priorityDimension.placement).toBe('placement')
    expect(defaultOpinionConfig.priorityDimension.overall).toBeNull()
  })

  it('returns defaults when no override is given', () => {
    expect(resolveOpinionConfig()).toEqual(defaultOpinionConfig)
  })

  it('merges an override onto the defaults', () => {
    const merged = resolveOpinionConfig({ candidateLimit: 3, strengthsTopN: 1 })
    expect(merged.candidateLimit).toBe(3)
    expect(merged.strengthsTopN).toBe(1)
    // Untouched fields keep their defaults.
    expect(merged.weaknessesBottomN).toBe(defaultOpinionConfig.weaknessesBottomN)
    expect(defaultOpinionConfig.candidateLimit).not.toBe(3) // defaults untouched
  })

  it('excludes meta signals from the substantive dimensions', () => {
    expect(SUBSTANTIVE_DIMENSIONS).not.toContain('nirfPresence')
    expect(SUBSTANTIVE_DIMENSIONS).not.toContain('dataCompleteness')
    expect(SUBSTANTIVE_DIMENSIONS).not.toContain('availableBranches')
    expect(SUBSTANTIVE_DIMENSIONS).toContain('placement')
  })
})
