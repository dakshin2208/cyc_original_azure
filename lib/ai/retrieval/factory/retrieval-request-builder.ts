/**
 * @module lib/ai/retrieval/factory/retrieval-request-builder
 *
 * An immutable builder that assembles a {@link RetrievalRequest} from a
 * {@link StructuredQuery} (Module 9). Pure DTO assembly — no selection, ranking,
 * or retrieval logic. Each `with*` returns a new builder; `build()` returns a
 * frozen request. Filters default to the query's own filters (reuse).
 */

import type { QueryFilter, StructuredQuery } from '@/lib/ai/query'
import type { RankingStrategy } from '../ranking'
import type { RetrievalRequest } from '../request'
import type { RepositoryKind } from '../sources'
import type { RetrievalStrategy } from '../strategy'

/** The default, balanced ranking strategy applied when none is specified. */
export const DEFAULT_RANKING_STRATEGY: RankingStrategy = {
  name: 'balanced',
  weights: { confidence: 0.4, freshness: 0.2, completeness: 0.2, priority: 0.2 },
}

/** The default retrieval strategy applied when none is specified. */
export const DEFAULT_RETRIEVAL_STRATEGY: RetrievalStrategy = { kind: 'hybrid', description: null }

/** Default maximum total evidence returned. */
export const DEFAULT_LIMIT = 20
/** Default retrieval timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 5000

/** Build a default retrieval request seeded from a structured query. */
function defaultRequest(query: StructuredQuery, createdAt: string): RetrievalRequest {
  return {
    query,
    repositories: [],
    filters: query.filters,
    limit: DEFAULT_LIMIT,
    perSourceLimit: null,
    strategy: DEFAULT_RETRIEVAL_STRATEGY,
    ranking: DEFAULT_RANKING_STRATEGY,
    requestedEvidence: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    createdAt,
  }
}

/**
 * Immutable builder for {@link RetrievalRequest}. Construct via
 * {@link RetrievalRequestBuilder.create} or the retrieval factory.
 */
export class RetrievalRequestBuilder {
  private constructor(private readonly draft: RetrievalRequest) {}

  /** Create a builder seeded with a structured query and a creation time. */
  static create(query: StructuredQuery, createdAt: string): RetrievalRequestBuilder {
    return new RetrievalRequestBuilder(defaultRequest(query, createdAt))
  }

  private with(patch: Partial<RetrievalRequest>): RetrievalRequestBuilder {
    return new RetrievalRequestBuilder({ ...this.draft, ...patch })
  }

  /** Set the repository kinds to search. */
  withRepositories(repositories: readonly RepositoryKind[]): RetrievalRequestBuilder {
    return this.with({ repositories })
  }

  /** Replace the filters. */
  withFilters(filters: readonly QueryFilter[]): RetrievalRequestBuilder {
    return this.with({ filters })
  }

  /** Set the maximum total evidence. */
  withLimit(limit: number): RetrievalRequestBuilder {
    return this.with({ limit })
  }

  /** Set the per-source evidence cap (`null` for none). */
  withPerSourceLimit(perSourceLimit: number | null): RetrievalRequestBuilder {
    return this.with({ perSourceLimit })
  }

  /** Set the retrieval strategy. */
  withStrategy(strategy: RetrievalStrategy): RetrievalRequestBuilder {
    return this.with({ strategy })
  }

  /** Set the ranking strategy. */
  withRanking(ranking: RankingStrategy): RetrievalRequestBuilder {
    return this.with({ ranking })
  }

  /** Set the explicitly-requested evidence kinds. */
  withRequestedEvidence(requestedEvidence: readonly RepositoryKind[]): RetrievalRequestBuilder {
    return this.with({ requestedEvidence })
  }

  /** Set the retrieval timeout. */
  withTimeout(timeoutMs: number): RetrievalRequestBuilder {
    return this.with({ timeoutMs })
  }

  /** Produce the immutable {@link RetrievalRequest}. */
  build(): RetrievalRequest {
    return Object.freeze({ ...this.draft })
  }
}

/** Create a {@link RetrievalRequestBuilder} seeded with a query and creation time. */
export function createRetrievalRequestBuilder(
  query: StructuredQuery,
  createdAt: string,
): RetrievalRequestBuilder {
  return RetrievalRequestBuilder.create(query, createdAt)
}
