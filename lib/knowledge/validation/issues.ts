/**
 * @module lib/knowledge/validation/issues
 * Validation issue model for the warehouse build.
 */

/** Severity of a build-time data issue. */
export type ValidationSeverity = 'error' | 'warning'

/** The category of a build-time issue (drives report counters). */
export type IssueKind = 'missing_field' | 'duplicate' | 'other'

/** A single data-quality issue encountered while building the warehouse. */
export interface ValidationIssue {
  /** Severity. */
  readonly severity: ValidationSeverity
  /** The category of issue. */
  readonly kind: IssueKind
  /** The dataset/file the issue came from. */
  readonly source: string
  /** The offending field, when applicable. */
  readonly field: string | null
  /** Human-readable description. */
  readonly message: string
}
