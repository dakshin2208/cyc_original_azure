/**
 * @module lib/ai/retrieval/result/retrieval-result
 *
 * The canonical retrieval result (Module 6): the retrieved context plus
 * operation-level statistics, latency, and status. Model only.
 */

import type { RetrievalStatistics, RetrievedContext } from '../context'

/** The overall outcome of a retrieval operation. */
export type RetrievalStatus =
  /** All targeted sources responded successfully. */
  | 'complete'
  /** Some sources succeeded and some failed/were skipped. */
  | 'partial'
  /** All sources responded but no evidence matched. */
  | 'empty'
  /** Retrieval failed entirely. */
  | 'failed'

/** The full result of retrieving knowledge for a query. */
export interface RetrievalResult {
  /** The retrieved, ranked, attributed evidence and its metadata. */
  readonly context: RetrievedContext
  /** Operation and per-source statistics. */
  readonly statistics: RetrievalStatistics
  /** Total wall-clock latency in milliseconds. */
  readonly latencyMs: number
  /** The overall status of the operation. */
  readonly status: RetrievalStatus
}
