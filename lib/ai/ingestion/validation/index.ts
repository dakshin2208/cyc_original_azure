/**
 * @module lib/ai/ingestion/validation
 * Barrel for validation models, errors, and the validator contract (Module 7).
 */
export { PREPARATION_ISSUE_CODES } from './issues'
export type { IngestionSeverity, PreparationIssueCode, PreparationIssue } from './issues'
export type {
  ValidationOutcome,
  DocumentValidation,
  MetadataValidation,
  ChunkValidation,
  PreparationValidation,
  PreparationValidationReport,
} from './validation'
export {
  IngestionError,
  DocumentParseError,
  UnsupportedDocumentTypeError,
  DuplicateDocumentError,
} from './errors'
export type { IngestionErrorType } from './errors'
export type { KnowledgePreparationValidator } from './validator'
