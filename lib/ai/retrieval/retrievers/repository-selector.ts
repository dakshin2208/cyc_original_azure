/**
 * @module lib/ai/retrieval/retrievers/repository-selector
 *
 * The repository-selector contract (Modules 3 & 8). Given a structured query, it
 * decides which repository kinds to search (e.g. eligibility → cutoff + college +
 * branch, NOT documents). Interface only — no selection logic here.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { StructuredQuery } from '@/lib/ai/query'
import type { RepositorySelection } from '../selection'

/** Selects the repositories to search for a structured query. */
export interface RepositorySelector {
  /**
   * Choose which repository kinds to search.
   * @param query   The structured query (never raw text).
   * @param context The current turn's request context.
   */
  select(query: StructuredQuery, context: RequestContext): RepositorySelection
}
