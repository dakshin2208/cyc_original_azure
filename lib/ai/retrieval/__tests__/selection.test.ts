/**
 * Repository selection tests: the selector contract chooses the right repository
 * kinds per intent (eligibility → cutoff/college/branch, comparison →
 * college/statistics, fees → fees) and never documents for structured intents.
 */

import { describe, expect, it } from 'vitest'
import { FakeRepositorySelector, makeContext, makeStructuredQuery } from '@/lib/ai/retrieval/__tests__/support'

const selector = new FakeRepositorySelector()

describe('RepositorySelector contract', () => {
  it('selects cutoff, college, and branch for eligibility — not documents', () => {
    const selection = selector.select(makeStructuredQuery('eligibility'), makeContext())
    expect(selection.kinds).toEqual(['cutoff', 'college', 'branch'])
    expect(selection.kinds).not.toContain('document')
    expect(selection.reason).toContain('eligibility')
  })

  it('selects college and statistics for comparison', () => {
    const selection = selector.select(makeStructuredQuery('comparison'), makeContext())
    expect(selection.kinds).toEqual(['college', 'statistics'])
  })

  it('selects fees for a fees query', () => {
    const selection = selector.select(makeStructuredQuery('fees'), makeContext())
    expect(selection.kinds).toEqual(['fees'])
  })

  it('falls back to college for unmapped intents', () => {
    const selection = selector.select(makeStructuredQuery('unknown'), makeContext())
    expect(selection.kinds).toEqual(['college'])
  })
})
