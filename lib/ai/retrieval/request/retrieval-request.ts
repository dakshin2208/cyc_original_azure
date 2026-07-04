/**
 * @module lib/ai/retrieval/request/retrieval-request
 *
 * The canonical retrieval request (Module 5): everything the retriever needs to
 * gather knowledge for a structured query. Immutable model — reuses the Sprint 4
 * {@link StructuredQuery} and {@link QueryFilter}. Model only.
 */

import type { QueryFilter, StructuredQuery } from '@/lib/ai/query'
import type { RankingStrategy } from '../ranking'
import type { RepositoryKind } from '../sources'
import type { RetrievalStrategy } from '../strategy'

/** A complete, self-contained request to retrieve knowledge for a query. */
export interface RetrievalRequest {
  /** The structured query driving retrieval (never raw text). */
  readonly query: StructuredQuery
  /** The repository kinds to search (from the selector). */
  readonly repositories: readonly RepositoryKind[]
  /** Filters to apply across sources. */
  readonly filters: readonly QueryFilter[]
  /** Maximum total evidence to return. */
  readonly limit: number
  /** Maximum evidence per source, or `null` for no per-source cap. */
  readonly perSourceLimit: number | null
  /** How each repository is searched. */
  readonly strategy: RetrievalStrategy
  /** How retrieved evidence is ranked. */
  readonly ranking: RankingStrategy
  /** The repository kinds whose evidence is explicitly requested. */
  readonly requestedEvidence: readonly RepositoryKind[]
  /** Overall retrieval timeout in milliseconds. */
  readonly timeoutMs: number
  /** ISO-8601 timestamp when the request was created. */
  readonly createdAt: string
}
