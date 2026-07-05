/**
 * @module lib/ai/query/validation
 * Barrel for the query validator (Module 6).
 */
export { VALIDATION_CODES } from './validation-result'
export type {
  ValidationSeverity,
  ValidationCode,
  ValidationIssue,
  ValidationResult,
} from './validation-result'
export { QueryValidationError } from './validation-error'
export type { QueryValidator } from './query-validator'
