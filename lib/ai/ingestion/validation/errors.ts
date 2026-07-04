/**
 * @module lib/ai/ingestion/validation/errors
 *
 * Ingestion error types. Extend the shared {@link AiError} hierarchy (reuse, not
 * duplication) for failures that callers prefer to throw.
 */

import { AiError, type AiErrorOptions } from '@/lib/ai/shared'

/** Base error for the ingestion layer. */
export class IngestionError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('INTERNAL', message, options)
  }
}

/** A document could not be parsed. */
export class DocumentParseError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('VALIDATION', message, options)
  }
}

/** No parser is registered for the document type. */
export class UnsupportedDocumentTypeError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('VALIDATION', message, options)
  }
}

/** A duplicate document was detected during ingestion. */
export class DuplicateDocumentError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('CONFLICT', message, options)
  }
}

/** The union of all ingestion error types. */
export type IngestionErrorType =
  | IngestionError
  | DocumentParseError
  | UnsupportedDocumentTypeError
  | DuplicateDocumentError
