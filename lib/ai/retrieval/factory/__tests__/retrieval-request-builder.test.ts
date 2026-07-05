/**
 * Retrieval factory & request builder tests: DI, defaults, immutability, filter
 * seeding from the structured query, and clock-stamped createdAt.
 */

import { describe, expect, it } from 'vitest'
import {
  createRetrievalFactory,
  DEFAULT_LIMIT,
  DEFAULT_RANKING_STRATEGY,
  DEFAULT_TIMEOUT_MS,
} from '@/lib/ai/retrieval'
import { FixedClock, makeStructuredQuery } from '@/lib/ai/retrieval/__tests__/support'

const factory = createRetrievalFactory({ clock: new FixedClock() })

describe('RetrievalFactory / RetrievalRequestBuilder', () => {
  it('builds a default request from a structured query (DI clock-stamped)', () => {
    const query = makeStructuredQuery('eligibility', 'Can I get CSE with 186 cutoff?')
    const request = factory.newRequestBuilder(query).build()

    expect(request.query).toBe(query)
    expect(request.repositories).toEqual([])
    expect(request.limit).toBe(DEFAULT_LIMIT)
    expect(request.perSourceLimit).toBeNull()
    expect(request.strategy.kind).toBe('hybrid')
    expect(request.ranking).toEqual(DEFAULT_RANKING_STRATEGY)
    expect(request.timeoutMs).toBe(DEFAULT_TIMEOUT_MS)
    expect(request.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('seeds filters from the structured query', () => {
    const query = makeStructuredQuery('recommendation')
    const request = factory.newRequestBuilder(query).build()
    expect(request.filters).toBe(query.filters)
  })

  it('is immutable — with* returns a new builder', () => {
    const query = makeStructuredQuery('eligibility')
    const base = factory.newRequestBuilder(query)
    const limited = base.withLimit(5).withRepositories(['cutoff', 'college'])
    expect(base.build().limit).toBe(DEFAULT_LIMIT)
    expect(limited.build().limit).toBe(5)
    expect(limited.build().repositories).toEqual(['cutoff', 'college'])
  })

  it('applies every override', () => {
    const query = makeStructuredQuery('comparison')
    const request = factory
      .newRequestBuilder(query)
      .withRepositories(['college', 'statistics'])
      .withPerSourceLimit(10)
      .withStrategy({ kind: 'exact_match', description: null })
      .withRanking({ name: 'freshness-first', weights: { confidence: 0.2, freshness: 0.5, completeness: 0.2, priority: 0.1 } })
      .withRequestedEvidence(['statistics'])
      .withTimeout(1000)
      .build()

    expect(request.repositories).toEqual(['college', 'statistics'])
    expect(request.perSourceLimit).toBe(10)
    expect(request.strategy.kind).toBe('exact_match')
    expect(request.ranking.name).toBe('freshness-first')
    expect(request.requestedEvidence).toEqual(['statistics'])
    expect(request.timeoutMs).toBe(1000)
  })

  it('produces a frozen request', () => {
    const request = factory.newRequestBuilder(makeStructuredQuery('fees')).build()
    expect(Object.isFrozen(request)).toBe(true)
  })
})
