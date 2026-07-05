/**
 * @module lib/ai/retrieval/context/retrieval-metadata
 *
 * Metadata describing a retrieval operation (Module 1): what intent drove it,
 * which sources/kinds were searched, and with what strategy. Model only.
 */

import type { KnowledgeSourceId } from '@/lib/ai/knowledge'
import type { QueryIntentType } from '@/lib/ai/query'
import type { RetrievalStrategyKind } from '../strategy'
import type { RepositoryKind } from '../sources'

/** Describes how a {@link RetrievedContext} was produced. */
export interface RetrievalMetadata {
  /** The query intent that drove retrieval. */
  readonly intent: QueryIntentType
  /** ISO-8601 timestamp when retrieval completed. */
  readonly retrievedAt: string
  /** The sources actually searched. */
  readonly repositoriesSearched: readonly KnowledgeSourceId[]
  /** The repository kinds searched. */
  readonly kindsSearched: readonly RepositoryKind[]
  /** The retrieval strategy applied. */
  readonly strategy: RetrievalStrategyKind
}
