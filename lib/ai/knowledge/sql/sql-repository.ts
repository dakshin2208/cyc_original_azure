/**
 * @module lib/ai/knowledge/sql/sql-repository
 *
 * SQL-flavored knowledge contracts. A {@link SqlRepository} is a
 * {@link KnowledgeRepository} that additionally supports named, parameterized
 * catalog queries (mirroring the vetted query-catalog concept). Interfaces only
 * — no query execution is implemented here.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type {
  KnowledgeQuery,
  KnowledgeRecord,
  KnowledgeResult,
  RepositoryResult,
} from '../contracts'
import type { KnowledgeRepository } from '../contracts'

/** A row returned by a SQL source. */
export type SqlRow = Readonly<Record<string, unknown>>

/** A SQL knowledge record whose content is a row. */
export interface SqlKnowledgeRecord<T extends SqlRow = SqlRow> extends KnowledgeRecord<T> {}

/** Parameters bound into a named catalog query. */
export type SqlQueryParams = Readonly<Record<string, unknown>>

/** A SQL-flavored query: an ad-hoc {@link KnowledgeQuery} or a named catalog query. */
export interface SqlQuery extends KnowledgeQuery {
  /** Name of a vetted catalog query to run, when using the catalog path. */
  readonly namedQuery?: string
  /** Parameters for the named query. */
  readonly params?: SqlQueryParams
}

/** A repository backed by a structured (SQL) source. */
export interface SqlRepository<T extends SqlRow = SqlRow> extends KnowledgeRepository<T> {
  /**
   * Run a named catalog query with parameters.
   * @param name    The vetted catalog query name.
   * @param params  Bound parameters.
   * @param context The current turn's request context.
   */
  queryNamed(
    name: string,
    params: SqlQueryParams,
    context: RequestContext,
  ): Promise<RepositoryResult<KnowledgeResult<T>>>
}
