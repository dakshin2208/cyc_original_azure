/**
 * @module lib/recommendation/__tests__/eligibility.test
 * Eligibility Engine (Module 3): Dream/Reach/Target/Safe banding + missing data.
 */

import { describe, expect, it } from 'vitest'
import {
  createEligibilityEngine,
  createTableCutoffLookup,
  nullCutoffLookup,
  resolveConfig,
  type CutoffLookup,
} from '@/lib/recommendation'
import { college, makeHarness, NAME, OC } from './support'

const config = resolveConfig() // safeMargin 8, reachMargin 5

/** A lookup that returns a fixed closing cutoff for every query. */
const fixed = (value: number): CutoffLookup => ({ getClosingCutoff: () => value })

describe('eligibility engine', () => {
  const { repos } = makeHarness()
  const alpha = college(repos, NAME.alpha)

  it('classifies SAFE when the student clears the closing cutoff by the safe margin', () => {
    const engine = createEligibilityEngine(fixed(190), config)
    const a = engine.assess({ college: alpha, studentCutoff: 199, community: OC })
    expect(a.category).toBe('safe')
    expect(a.margin).toBe(9)
    expect(a.hasData).toBe(true)
  })

  it('classifies TARGET when above the cutoff but within the safe margin', () => {
    const engine = createEligibilityEngine(fixed(190), config)
    expect(engine.assess({ college: alpha, studentCutoff: 194, community: OC }).category).toBe('target')
    // Exactly at the closing cutoff is still a target (margin 0).
    expect(engine.assess({ college: alpha, studentCutoff: 190, community: OC }).category).toBe('target')
  })

  it('classifies REACH when just below the cutoff (within the reach margin)', () => {
    const engine = createEligibilityEngine(fixed(190), config)
    expect(engine.assess({ college: alpha, studentCutoff: 186, community: OC }).category).toBe('reach')
    // Boundary: 5 below → still reach.
    expect(engine.assess({ college: alpha, studentCutoff: 185, community: OC }).category).toBe('reach')
  })

  it('classifies DREAM when well below the closing cutoff', () => {
    const engine = createEligibilityEngine(fixed(190), config)
    const a = engine.assess({ college: alpha, studentCutoff: 180, community: OC })
    expect(a.category).toBe('dream')
    expect(a.margin).toBe(-10)
  })

  it('degrades gracefully to UNKNOWN when no cutoff data is available', () => {
    const engine = createEligibilityEngine(nullCutoffLookup, config)
    const a = engine.assess({ college: alpha, studentCutoff: 195, community: OC })
    expect(a.category).toBe('unknown')
    expect(a.hasData).toBe(false)
    expect(a.closingCutoff).toBeNull()
    expect(a.margin).toBeNull()
  })

  it('honours an injected per-college/community table', () => {
    const table = createTableCutoffLookup([
      { collegeId: alpha.id, community: 'OC', closingCutoff: 198 },
    ])
    const engine = createEligibilityEngine(table, config)
    // Known → assessed.
    expect(engine.assess({ college: alpha, studentCutoff: 199, community: OC }).category).toBe('target')
    // Unknown community → falls back to unknown.
    const beta = college(repos, NAME.beta)
    expect(engine.assess({ college: beta, studentCutoff: 199, community: OC }).category).toBe('unknown')
  })
})
