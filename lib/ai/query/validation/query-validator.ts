/**
 * @module lib/ai/query/validation/query-validator
 *
 * The validator contract (Module 6). Interface only — no validation logic. A
 * validator inspects a {@link StructuredQuery} and reports a {@link ValidationResult}.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { StructuredQuery } from '../model'
import type { ValidationResult } from './validation-result'

/** Validates a structured query for well-formedness and completeness. */
export interface QueryValidator {
  /**
   * Validate a structured query.
   * @param query   The structured query to validate.
   * @param context The current turn's request context.
   */
  validate(query: StructuredQuery, context: RequestContext): ValidationResult
}
