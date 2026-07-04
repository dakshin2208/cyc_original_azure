/**
 * @module lib/ai/query/validation/validation-result
 *
 * Validation result and issue models (Module 6). Models only — no validation
 * logic. A validator reports issues and a resulting {@link ValidationState}.
 */

import type { ValidationState } from '../model'

/** Severity of a validation issue. */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/** Machine-readable validation issue codes. */
export const VALIDATION_CODES = [
  'missing_required',
  'invalid_value',
  'out_of_range',
  'ambiguous_entity',
  'unsupported_intent',
  'conflicting_constraints',
] as const

/** A machine-readable validation issue code. */
export type ValidationCode = (typeof VALIDATION_CODES)[number]

/** A single problem found while validating a structured query. */
export interface ValidationIssue {
  /** Machine-readable code. */
  readonly code: ValidationCode
  /** Severity. */
  readonly severity: ValidationSeverity
  /** The offending field/entity, when applicable. */
  readonly field: string | null
  /** Human-readable description. */
  readonly message: string
}

/** The outcome of validating a structured query. */
export interface ValidationResult {
  /** Resulting validation state. */
  readonly state: ValidationState
  /** All issues found (may be empty). */
  readonly issues: readonly ValidationIssue[]
  /** Convenience flag: `true` when there are no `error`-severity issues. */
  readonly valid: boolean
}
