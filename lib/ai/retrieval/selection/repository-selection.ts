/**
 * @module lib/ai/retrieval/selection/repository-selection
 *
 * Models describing which repositories a query should target (Module 3). The
 * `RepositorySelectionPolicy` type expresses the intent→kinds mapping as data;
 * NO concrete policy instance or selection logic is provided here (that is a
 * future implementation). Models only.
 */

import type { QueryIntentType } from '@/lib/ai/query'
import type { RepositoryKind } from '../sources'

/** The repositories chosen for a query, with the rationale. */
export interface RepositorySelection {
  /** The repository kinds to search. */
  readonly kinds: readonly RepositoryKind[]
  /** Why these repositories were chosen (for observability/explainability). */
  readonly reason: string
}

/**
 * A declarative mapping from query intent to the repository kinds that should be
 * searched. The concrete default policy is supplied by a future implementation;
 * this type defines its shape so it can be configured and extended.
 */
export type RepositorySelectionPolicy = Readonly<Record<QueryIntentType, readonly RepositoryKind[]>>
