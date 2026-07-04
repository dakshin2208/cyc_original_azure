/**
 * @module lib/ai/query/validation/validation-error
 *
 * Validation error type for the Query Understanding Layer. Extends the shared
 * {@link AiError} hierarchy (reuse, not duplication) for cases where a caller
 * prefers throwing over returning a {@link ValidationResult}.
 */

import { AiError, type AiErrorOptions } from '@/lib/ai/shared'
import type { ValidationIssue } from './validation-result'

/** Thrown when a structured query fails validation and the caller opts to throw. */
export class QueryValidationError extends AiError {
  /** The issues that caused the failure. */
  readonly issues: readonly ValidationIssue[]

  constructor(issues: readonly ValidationIssue[], options: AiErrorOptions = {}) {
    super('VALIDATION', `Query failed validation with ${issues.length} issue(s).`, {
      safeMessage: 'The request could not be understood completely.',
      ...options,
      detail: { issues, ...options.detail },
    })
    this.issues = issues
  }
}
