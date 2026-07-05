/**
 * @module lib/ai/knowledge/contracts/errors
 *
 * The error taxonomy for the Knowledge Access Layer. These extend the shared
 * {@link AiError} hierarchy (reuse, not duplication) so they interoperate with
 * the platform's error handling and the {@link RepositoryResult} envelope.
 */

import { AiError, type AiErrorOptions } from '@/lib/ai/shared'
import type { KnowledgeSourceId } from './identifiers'

/** A requested knowledge source is not registered. */
export class SourceNotFoundError extends AiError {
  /** The unresolved source id. */
  readonly sourceId: KnowledgeSourceId
  constructor(sourceId: KnowledgeSourceId, options: AiErrorOptions = {}) {
    super('NOT_FOUND', `Knowledge source "${sourceId}" is not registered.`, {
      safeMessage: 'The requested knowledge source is unavailable.',
      ...options,
      detail: { sourceId, ...options.detail },
    })
    this.sourceId = sourceId
  }
}

/** A source with the same id is already registered. */
export class SourceAlreadyRegisteredError extends AiError {
  /** The conflicting source id. */
  readonly sourceId: KnowledgeSourceId
  constructor(sourceId: KnowledgeSourceId, options: AiErrorOptions = {}) {
    super('CONFLICT', `Knowledge source "${sourceId}" is already registered.`, {
      ...options,
      detail: { sourceId, ...options.detail },
    })
    this.sourceId = sourceId
  }
}

/** A source is registered but currently unavailable/unreachable. */
export class SourceUnavailableError extends AiError {
  /** The affected source id. */
  readonly sourceId: KnowledgeSourceId
  constructor(sourceId: KnowledgeSourceId, message: string, options: AiErrorOptions = {}) {
    super('RETRIEVAL', message, {
      retryable: true,
      safeMessage: 'This knowledge source is temporarily unavailable.',
      ...options,
      detail: { sourceId, ...options.detail },
    })
    this.sourceId = sourceId
  }
}

/** A repository operation failed. */
export class RepositoryError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('RETRIEVAL', message, options)
  }
}

/** A query was malformed or unsupported by the target repository. */
export class QueryError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('VALIDATION', message, options)
  }
}

/**
 * The union of all Knowledge Access Layer error types. Used as the failure type
 * of {@link RepositoryResult}.
 */
export type KnowledgeError =
  | SourceNotFoundError
  | SourceAlreadyRegisteredError
  | SourceUnavailableError
  | RepositoryError
  | QueryError
