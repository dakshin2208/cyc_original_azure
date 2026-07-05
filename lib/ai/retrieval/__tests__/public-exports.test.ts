/**
 * Public API tests: the retrieval layer's runtime exports are reachable from the
 * single public barrel and carry the expected values.
 */

import { describe, expect, it } from 'vitest'
import {
  REPOSITORY_KINDS,
  RETRIEVAL_STRATEGY_KINDS,
  DEFAULT_RANKING_STRATEGY,
  DEFAULT_RETRIEVAL_STRATEGY,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
  RetrievalRequestBuilder,
  createRetrievalRequestBuilder,
  createRetrievalFactory,
} from '@/lib/ai/retrieval'

describe('lib/ai/retrieval public API', () => {
  it('exports the repository-kind vocabulary', () => {
    expect(REPOSITORY_KINDS).toContain('cutoff')
    expect(REPOSITORY_KINDS).toContain('college')
    expect(REPOSITORY_KINDS).toContain('document')
  })

  it('exports the retrieval-strategy vocabulary (with reserved future kinds)', () => {
    expect(RETRIEVAL_STRATEGY_KINDS).toContain('keyword')
    expect(RETRIEVAL_STRATEGY_KINDS).toContain('hybrid')
    expect(RETRIEVAL_STRATEGY_KINDS).toContain('vector')
    expect(RETRIEVAL_STRATEGY_KINDS).toContain('semantic')
  })

  it('exports well-formed defaults', () => {
    expect(DEFAULT_LIMIT).toBeGreaterThan(0)
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0)
    expect(DEFAULT_RETRIEVAL_STRATEGY.kind).toBe('hybrid')
    const w = DEFAULT_RANKING_STRATEGY.weights
    expect(w.confidence + w.freshness + w.completeness + w.priority).toBeCloseTo(1)
  })

  it('exports the builder and factory constructors', () => {
    expect(typeof createRetrievalFactory).toBe('function')
    expect(typeof createRetrievalRequestBuilder).toBe('function')
    expect(typeof RetrievalRequestBuilder.create).toBe('function')
  })
})
