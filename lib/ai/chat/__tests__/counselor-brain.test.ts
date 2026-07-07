/**
 * @module lib/ai/chat/__tests__/counselor-brain.test
 *
 * The Orchestration Brain in ISOLATION (Phase 4 extraction). Proves the pure route
 * selection independent of the pipeline: given a context, decideTurn returns the correct
 * capability/route and executes nothing. The full end-to-end routing is separately
 * covered by conversation-flow.test.ts; this pins the decision mapping directly.
 */

import { describe, expect, it } from 'vitest'
import type { ParsedQuery } from '@/lib/ai/orchestration'
import { decideTurn, emptyProfile } from '@/lib/ai/chat'
import type { StudentProfile } from '@/lib/ai/chat'

/** A complete profile (all four slots answered) — the "ready" state. */
const complete: StudentProfile = {
  ...emptyProfile(),
  cutoff: 190,
  community: 'OC',
  district: 'coimbatore',
  branch: 'CSE',
  answered: { cutoff: true, community: true, district: true, branch: true },
} as StudentProfile

/** A minimal parsed-query stub with only the fields decideTurn reads. */
const parse = (over: Partial<ParsedQuery> = {}): ParsedQuery =>
  ({ colleges: [], hasMultipleColleges: false, normalized: '', outOfDomain: null, unverifiedCollege: false, ...over } as ParsedQuery)

const ctx = (over: Partial<Parameters<typeof decideTurn>[0]>) =>
  decideTurn({
    message: '',
    parsed: parse(),
    priorProfile: complete,
    profile: complete,
    wasComplete: true,
    hasQuestion: false,
    ...over,
  })

describe('Orchestration Brain — decideTurn route selection', () => {
  it('collects the first missing slot when the profile is incomplete', () => {
    const d = ctx({ profile: emptyProfile(), priorProfile: emptyProfile(), wasComplete: false })
    expect(d.kind).toBe('collectSlot')
    if (d.kind === 'collectSlot') {
      expect(d.slot).toBe('cutoff')
      expect(d.firstContact).toBe(true)
    }
  })

  it('summarizes onboarding the moment the profile becomes complete', () => {
    const d = ctx({ priorProfile: emptyProfile(), wasComplete: false })
    expect(d.kind).toBe('onboardingSummary')
  })

  it('routes an exclusion request', () => {
    const d = ctx({ message: 'remove PSG College of Technology', parsed: parse({ colleges: ['PSG College of Technology'] }) })
    expect(d.kind).toBe('exclude')
    if (d.kind === 'exclude') expect(d.colleges).toEqual(['PSG College of Technology'])
  })

  it('routes a tier query', () => {
    const d = ctx({ message: 'show me my safe and dream colleges', hasQuestion: true })
    expect(d.kind).toBe('tier')
  })

  it('asks for the second college on a one-sided comparison', () => {
    const d = ctx({ message: 'compare SSN with', parsed: parse({ colleges: ['SSN'] }), hasQuestion: true })
    expect(d.kind).toBe('compareNeedsTwo')
    if (d.kind === 'compareNeedsTwo') expect(d.found).toBe('SSN')
  })

  it('routes a scope refinement (government)', () => {
    const d = ctx({ message: 'show me government colleges only' })
    expect(d.kind).toBe('refine')
    if (d.kind === 'refine') expect(d.trigger).toMatch(/government/)
  })

  it('honestly declines fee questions (not in dataset)', () => {
    const d = ctx({ message: 'what are the fees?', hasQuestion: true })
    expect(d.kind).toBe('dataDecline')
    if (d.kind === 'dataDecline') expect(d.topic).toBe('fee')
  })

  it('answers a keyworded follow-up question about a named college', () => {
    // A named college makes refinementTrigger return null, so a bare question falls
    // through to the direct-answer route (ordering preserved from the original cascade).
    const d = ctx({ message: 'is PSG College of Technology good?', parsed: parse({ colleges: ['PSG College of Technology'] }), hasQuestion: true })
    expect(d.kind).toBe('answerQuestion')
  })

  it('nudges on a pure social message', () => {
    expect(ctx({ message: 'thanks' }).kind).toBe('social')
  })

  it('defaults to a recommendation for any other complete-profile input', () => {
    expect(ctx({ message: 'give me college names' }).kind).toBe('recommend')
  })
})
