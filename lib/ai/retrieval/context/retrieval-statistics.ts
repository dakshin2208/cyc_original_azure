/**
 * @module lib/ai/retrieval/context/retrieval-statistics
 *
 * Per-operation and per-source retrieval statistics (Module 1). Model only.
 */

import type { KnowledgeSourceId } from '@/lib/ai/knowledge'
import type { RepositoryKind } from '../sources'

/** The outcome of retrieving from a single source. */
export type SourceRetrievalStatus = 'ok' | 'partial' | 'failed' | 'skipped'

/** Statistics for retrieval from a single source. */
export interface SourceStatistics {
  /** The source. */
  readonly sourceId: KnowledgeSourceId
  /** The repository kind. */
  readonly kind: RepositoryKind
  /** Records matched before limiting. */
  readonly matched: number
  /** Records returned after limiting. */
  readonly returned: number
  /** Latency for this source in milliseconds. */
  readonly latencyMs: number
  /** Per-source outcome. */
  readonly status: SourceRetrievalStatus
}

/** Aggregate statistics for a retrieval operation. */
export interface RetrievalStatistics {
  /** Total evidence returned across all sources. */
  readonly totalEvidence: number
  /** Total wall-clock latency in milliseconds. */
  readonly totalLatencyMs: number
  /** Per-source breakdown. */
  readonly perSource: readonly SourceStatistics[]
}
