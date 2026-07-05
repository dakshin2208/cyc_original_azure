/**
 * @module lib/ai/ingestion/validation/issues
 *
 * Validation issue vocabulary for the ingestion layer (Module 7). A local
 * severity/issue model is defined here (rather than importing the query layer's)
 * because ingestion is architecturally upstream of query understanding and must
 * not depend on it. Models only.
 */

/** Severity of an ingestion validation issue. */
export type IngestionSeverity = 'error' | 'warning' | 'info'

/** Machine-readable ingestion validation issue codes. */
export const PREPARATION_ISSUE_CODES = [
  'parse_failed',
  'empty_document',
  'unsupported_type',
  'invalid_metadata',
  'missing_required_metadata',
  'checksum_mismatch',
  'duplicate_document',
  'empty_chunk',
  'chunk_too_large',
] as const

/** A machine-readable ingestion validation issue code. */
export type PreparationIssueCode = (typeof PREPARATION_ISSUE_CODES)[number]

/** A single validation problem encountered during preparation. */
export interface PreparationIssue {
  /** Machine-readable code. */
  readonly code: PreparationIssueCode
  /** Severity. */
  readonly severity: IngestionSeverity
  /** The offending target (document id, chunk id, field), when applicable. */
  readonly target: string | null
  /** Human-readable description. */
  readonly message: string
}
