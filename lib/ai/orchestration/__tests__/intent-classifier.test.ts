/**
 * @module lib/ai/orchestration/__tests__/intent-classifier.test
 * IntentClassifier — keyword scoring, entity boosts, priority tie-break.
 */

import { describe, expect, it } from 'vitest'
import { communityCode, type CanonicalCollege, type CommunityCode } from '@/lib/knowledge'
import { createIntentClassifier, normalizeQuestion, type ExtractionOutput } from '@/lib/ai/orchestration'

const classifier = createIntentClassifier()

/** Build a minimal ExtractionOutput exposing only the fields the classifier reads. */
function ext(o: {
  colleges?: number
  cutoff?: number | null
  community?: string | null
  branch?: string | null
}): ExtractionOutput {
  const colleges = Array.from({ length: o.colleges ?? 0 }, (_, i) => ({
    id: `c${i}`,
    name: `College ${i}`,
    nameSlug: `college-${i}`,
    city: null,
    state: null,
    nirfId: null,
    counsellingCodes: [],
    hasNirfData: false,
  })) as unknown as CanonicalCollege[]
  const community: CommunityCode | null = o.community ? communityCode(o.community) : null
  return { entities: [], colleges, branch: o.branch ?? null, community, studentCutoff: o.cutoff ?? null, location: null, unverifiedCollege: false }
}

const intentOf = (q: string, e: ExtractionOutput = ext({})): string =>
  classifier.classify(normalizeQuestion(q).normalized, e).intent

describe('intent classifier', () => {
  it('detects each supported intent from its keywords', () => {
    expect(intentOf('recommend a good college')).toBe('recommend_college')
    expect(intentOf('what are the placements')).toBe('placement_query')
    expect(intentOf('tell me about research output')).toBe('research_query')
    expect(intentOf('how good is the faculty')).toBe('faculty_query')
    expect(intentOf('is it worth it, what is the roi')).toBe('roi_query')
    expect(intentOf('what is the nirf ranking')).toBe('nirf_query')
    expect(intentOf('what is the closing cutoff')).toBe('cutoff_query')
    expect(intentOf('which branch should i take')).toBe('branch_advice')
  })

  it('routes two colleges to compare_colleges via the entity boost', () => {
    expect(intentOf('psg and anna', ext({ colleges: 2 }))).toBe('compare_colleges')
    // Explicit "compare" keyword also works with no resolved colleges yet.
    expect(intentOf('compare these two')).toBe('compare_colleges')
  })

  it('routes cutoff+community to eligibility_query', () => {
    expect(intentOf('can i get in with my marks', ext({ cutoff: 190, community: 'BC' }))).toBe('eligibility_query')
  })

  it('falls back to general_information when a college is named without an ask', () => {
    expect(intentOf('anna university', ext({ colleges: 1 }))).toBe('general_information')
  })

  it('returns unknown for empty / unrecognized input', () => {
    expect(intentOf('')).toBe('unknown')
    expect(intentOf('asdf qwer zxcv')).toBe('unknown')
  })

  it('gives higher confidence to clearer questions', () => {
    const clear = classifier.classify(normalizeQuestion('compare psg vs anna').normalized, ext({ colleges: 2 }))
    const vague = classifier.classify(normalizeQuestion('about it').normalized, ext({}))
    expect(clear.confidence).toBeGreaterThan(vague.confidence)
    expect(clear.confidence).toBeLessThanOrEqual(1)
  })

  it('is deterministic', () => {
    const e = ext({ cutoff: 180, community: 'OC' })
    const a = classifier.classify('can i get into anna with 180', e)
    const b = classifier.classify('can i get into anna with 180', e)
    expect(a).toEqual(b)
  })
})
