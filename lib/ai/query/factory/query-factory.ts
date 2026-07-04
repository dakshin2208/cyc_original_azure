/**
 * @module lib/ai/query/factory/query-factory
 *
 * The Query Factory (Module 10): creates {@link QueryBuilder}s seeded with a
 * clock-stamped context, using injected dependencies. It contains no
 * understanding logic — it only constructs builders (Dependency Injection).
 */

import type { QueryDependencies } from './dependencies'
import { createQueryBuilder, QueryBuilder } from './query-builder'

/** Produces seeded {@link QueryBuilder}s for assembling structured queries. */
export interface QueryFactory {
  /**
   * Create a new builder seeded with the original query text and the current
   * time (from the injected clock).
   * @param originalQuery The verbatim user text.
   */
  newBuilder(originalQuery: string): QueryBuilder
}

/**
 * Create a {@link QueryFactory} bound to injected dependencies.
 * @param dependencies Infrastructure (clock) from the runtime container.
 */
export function createQueryFactory(dependencies: QueryDependencies): QueryFactory {
  return Object.freeze({
    newBuilder(originalQuery: string): QueryBuilder {
      return createQueryBuilder(originalQuery, dependencies.clock.isoNow())
    },
  })
}
