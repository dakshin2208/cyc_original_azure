/**
 * @module lib/ai/ingestion/result/preparation-result
 *
 * The canonical output of the preparation pipeline (Module 8). Model only.
 */

import type { PreparationIssue, PreparationValidationReport } from '../validation'
import type { PreparedKnowledge } from './prepared-knowledge'
import type { PreparationStatistics } from './statistics'

/** The overall status of a preparation operation. */
export type PreparationStatus =
  /** Prepared successfully with no errors. */
  | 'prepared'
  /** Prepared with warnings (usable but flagged). */
  | 'partial'
  /** Rejected by validation (not usable). */
  | 'rejected'
  /** Failed to prepare (exception/parse failure). */
  | 'failed'

/** The complete result of preparing a document for retrieval. */
export interface PreparationResult {
  /** The prepared knowledge (document + chunks). */
  readonly knowledge: PreparedKnowledge
  /** Preparation statistics. */
  readonly statistics: PreparationStatistics
  /** The aggregate validation report. */
  readonly validation: PreparationValidationReport
  /** Error-severity issues. */
  readonly errors: readonly PreparationIssue[]
  /** Warning/info-severity issues. */
  readonly warnings: readonly PreparationIssue[]
  /** Overall status. */
  readonly status: PreparationStatus
}
