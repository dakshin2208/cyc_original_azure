/**
 * @module lib/ai/retrieval/factory/retrieval-factory
 *
 * The Retrieval Factory (Module 9): creates {@link RetrievalRequestBuilder}s
 * seeded with a clock-stamped creation time, using injected dependencies. No
 * retrieval, selection, or ranking logic — it only constructs builders
 * (Dependency Injection).
 */

import type { StructuredQuery } from '@/lib/ai/query'
import type { RetrievalDependencies } from './dependencies'
import { createRetrievalRequestBuilder, RetrievalRequestBuilder } from './retrieval-request-builder'

/** Produces seeded {@link RetrievalRequestBuilder}s for structured queries. */
export interface RetrievalFactory {
  /**
   * Create a new request builder seeded with a structured query and the current
   * time (from the injected clock).
   * @param query The structured query driving retrieval.
   */
  newRequestBuilder(query: StructuredQuery): RetrievalRequestBuilder
}

/**
 * Create a {@link RetrievalFactory} bound to injected dependencies.
 * @param dependencies Infrastructure (clock) from the runtime container.
 */
export function createRetrievalFactory(dependencies: RetrievalDependencies): RetrievalFactory {
  return Object.freeze({
    newRequestBuilder(query: StructuredQuery): RetrievalRequestBuilder {
      return createRetrievalRequestBuilder(query, dependencies.clock.isoNow())
    },
  })
}
