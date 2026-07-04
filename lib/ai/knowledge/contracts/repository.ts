/**
 * @module lib/ai/knowledge/contracts/repository
 *
 * The base repository contract — the single interface through which the rest of
 * the platform reads any knowledge source, regardless of backing (SQL, document,
 * vector, cache, API). Interface only.
 *
 * Every repository is also a {@link HealthCheck}. All operations receive the
 * per-turn {@link RequestContext} for auth-scoping and tracing, and return a
 * {@link RepositoryResult} so failures are typed rather than thrown.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { HealthCheck } from '../health'
import type { KnowledgeRecordId } from './identifiers'
import type { KnowledgeQuery } from './query'
import type { KnowledgeRecord } from './record'
import type { KnowledgeResult, RepositoryResult } from './result'
import type { KnowledgeSource } from './source'

/**
 * A source-agnostic knowledge repository.
 * @typeParam T The content type of records this repository returns.
 */
export interface KnowledgeRepository<T = unknown> extends HealthCheck {
  /** The descriptor of the source this repository serves. */
  readonly source: KnowledgeSource

  /**
   * Fetch a single record by id.
   * @returns the record, or `null` when not found (a successful, empty result).
   */
  get(
    id: KnowledgeRecordId,
    context: RequestContext,
  ): Promise<RepositoryResult<KnowledgeRecord<T> | null>>

  /**
   * Query for records matching a source-agnostic {@link KnowledgeQuery}.
   */
  query(
    query: KnowledgeQuery,
    context: RequestContext,
  ): Promise<RepositoryResult<KnowledgeResult<T>>>
}
