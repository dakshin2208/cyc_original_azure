/**
 * @module lib/opinion/__tests__/strategy.test
 * Strategy selection (Module 2) from intent + entities + priorities.
 */

import { describe, expect, it } from 'vitest'
import type { ParsedQuery } from '@/lib/ai/orchestration'
import { selectStrategy } from '@/lib/opinion'

function pq(o: Partial<ParsedQuery> & { intent: ParsedQuery['intent'] }): ParsedQuery {
  return {
    raw: '',
    normalized: '',
    tokens: [],
    intentConfidence: 1,
    entities: [],
    colleges: [],
    hasMultipleColleges: false,
    branch: null,
    community: null,
    studentCutoff: null,
    location: null,
    ...o,
  }
}

describe('selectStrategy', () => {
  it('maps intents to strategies', () => {
    expect(selectStrategy(pq({ intent: 'recommend_college' })).strategy).toBe('college_recommendation')
    expect(selectStrategy(pq({ intent: 'placement_query' })).strategy).toBe('placement_focused')
    expect(selectStrategy(pq({ intent: 'research_query' })).strategy).toBe('research_focused')
    expect(selectStrategy(pq({ intent: 'roi_query' })).strategy).toBe('budget_focused')
    expect(selectStrategy(pq({ intent: 'eligibility_query' })).strategy).toBe('eligibility_bands')
    expect(selectStrategy(pq({ intent: 'branch_advice' })).strategy).toBe('branch_recommendation')
    expect(selectStrategy(pq({ intent: 'unknown' })).strategy).toBe('general_counseling')
  })

  it('treats two colleges as a comparison regardless of intent', () => {
    expect(selectStrategy(pq({ intent: 'placement_query', hasMultipleColleges: true })).strategy).toBe('comparison')
  })

  it('derives priorities from intent, location, and fee entities', () => {
    expect(selectStrategy(pq({ intent: 'placement_query' })).priorities).toContain('placement')
    expect(selectStrategy(pq({ intent: 'recommend_college', location: 'coimbatore' })).priorities).toContain('location')
    expect(
      selectStrategy(pq({ intent: 'recommend_college', entities: [{ type: 'fees', value: 'fee', normalized: 'fee', raw: 'fee', confidence: 1 }] })).priorities,
    ).toContain('budget')
  })

  it('defaults to overall when nothing is specified, and honours overrides', () => {
    expect(selectStrategy(pq({ intent: 'general_information' })).priorities).toEqual(['overall'])
    expect(selectStrategy(pq({ intent: 'recommend_college' }), ['research']).priorities).toContain('research')
  })
})
