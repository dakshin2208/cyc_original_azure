/**
 * @module lib/ai/shared/ports/sql.port
 *
 * The structured-data boundary. Callers request *named*, parameterized queries
 * from a vetted catalog — never free-form SQL — which contains blast radius and
 * lets the adapter enforce governance/RLS (AI Architecture, doc 03 §10;
 * Project Structure, doc 07). The adapter implements this port over Supabase.
 */

import type { RequestContext } from '../contracts/request-context'
import type { SourceRef } from '../contracts/evidence'

/**
 * A request to run a named catalog query with typed parameters.
 * @typeParam P The parameter shape for the named query.
 */
export interface QueryIntent<P = Readonly<Record<string, unknown>>> {
  /** The catalog query name (must exist in the vetted registry). */
  readonly name: string
  /** Parameters bound into the query. */
  readonly params: P
}

/**
 * The typed result of a query, tagged with its source for provenance.
 * @typeParam Row The row shape returned by the query.
 */
export interface QueryResult<Row = Readonly<Record<string, unknown>>> {
  /** The returned rows. */
  readonly rows: readonly Row[]
  /** Where the rows came from (for provenance/citation). */
  readonly source: SourceRef
}

/**
 * The structured-data port. Implementations resolve a {@link QueryIntent} against
 * the vetted query catalog, enforce auth-scoping/RLS, and return typed rows.
 */
export interface SqlPort {
  /**
   * Execute a named catalog query.
   * @param intent The named query and its parameters.
   * @param context The current turn's request context (drives auth-scoping).
   * @typeParam Row The expected row shape.
   */
  run<Row = Readonly<Record<string, unknown>>>(
    intent: QueryIntent,
    context: RequestContext,
  ): Promise<QueryResult<Row>>
}
