/**
 * @module lib/ai/shared/errors/ai-error
 *
 * The typed error hierarchy for the AI platform.
 *
 * Design (Project Structure, doc 07 §12):
 * - A single `AiError` base carries a machine-readable {@link ErrorCode}, a
 *   **client-safe** message, optional structured `detail`, an optional `cause`,
 *   and a `retryable` hint.
 * - Subclasses fix the `code` so call sites can `catch` by type or by code.
 * - `toJSON()` intentionally omits the stack trace and raw `cause`, so serialized
 *   errors never leak internals to a client. The Gateway is the only layer that
 *   maps these to user-facing responses.
 *
 * These are *unexpected-failure* signals. Expected outcomes (abstention, "no
 * eligible seat", "data not available") are modeled as return values via the
 * {@link Result} pattern and the domain contracts — not thrown.
 */

import type { AbstentionReason } from '../enums'
import type { ErrorCode } from './error-codes'

/** Construction options shared by all {@link AiError}s. */
export interface AiErrorOptions {
  /** A short, user-safe explanation. Defaults to the technical message. */
  readonly safeMessage?: string
  /** Structured, non-sensitive context for logs and debugging. */
  readonly detail?: Readonly<Record<string, unknown>>
  /** The underlying error/value that caused this one (never serialized). */
  readonly cause?: unknown
  /** Whether retrying the same operation might succeed. Defaults to `false`. */
  readonly retryable?: boolean
}

/** JSON-safe shape produced by {@link AiError.toJSON}. */
export interface SerializedAiError {
  readonly name: string
  readonly code: ErrorCode
  readonly safeMessage: string
  readonly retryable: boolean
  readonly detail?: Readonly<Record<string, unknown>>
}

/**
 * Base class for all AI-platform errors.
 *
 * Prefer a specific subclass. Instantiate `AiError` directly only for a code
 * without a dedicated subclass.
 */
export class AiError extends Error {
  /** Machine-readable, stable error code. */
  readonly code: ErrorCode
  /** A message safe to surface to end users (no internals). */
  readonly safeMessage: string
  /** Structured, non-sensitive debugging context. */
  readonly detail?: Readonly<Record<string, unknown>>
  /** Whether the failing operation may be retried. */
  readonly retryable: boolean

  /**
   * @param code    Machine-readable error code.
   * @param message Technical message for logs (may contain internal detail).
   * @param options Optional safe message, structured detail, cause, retryability.
   */
  constructor(code: ErrorCode, message: string, options: AiErrorOptions = {}) {
    super(message)
    // Preserve the prototype chain so `instanceof` works across transpilation
    // targets and bundling (required when extending built-ins).
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.safeMessage = options.safeMessage ?? message
    this.detail = options.detail
    this.retryable = options.retryable ?? false
    if (options.cause !== undefined) {
      // `Error.cause` (ES2022) is available on the Node 20 runtime; assigned
      // directly to avoid depending on a specific `super` signature.
      this.cause = options.cause
    }
  }

  /**
   * Serialize to a JSON-safe object. Deliberately excludes the stack trace and
   * raw `cause` so it is safe to send to a client or log sink.
   */
  toJSON(): SerializedAiError {
    return {
      name: this.name,
      code: this.code,
      safeMessage: this.safeMessage,
      retryable: this.retryable,
      ...(this.detail ? { detail: this.detail } : {}),
    }
  }
}

/** Input failed validation (bad or missing arguments, malformed identifiers). */
export class ValidationError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('VALIDATION', message, options)
  }
}

/** A requested entity (college, branch, record) does not exist. */
export class NotFoundError extends AiError {
  /** The kind of entity that was not found (e.g. `'college'`, `'branch'`). */
  readonly resource: string

  constructor(resource: string, message: string, options: AiErrorOptions = {}) {
    super('NOT_FOUND', message, { ...options, detail: { resource, ...options.detail } })
    this.resource = resource
  }
}

/**
 * The counselor deliberately declined to answer. Modeled as an error only for
 * flows that prefer throwing; most abstentions are returned as domain values.
 */
export class AbstentionError extends AiError {
  /** Why the counselor abstained. */
  readonly reason: AbstentionReason

  constructor(reason: AbstentionReason, message: string, options: AiErrorOptions = {}) {
    super('ABSTENTION', message, { ...options, detail: { reason, ...options.detail } })
    this.reason = reason
  }
}

/** A retrieval operation failed at the Retrieval facade level. */
export class RetrievalError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('RETRIEVAL', message, options)
  }
}

/** A structured-data (SQL) query failed or was rejected by governance. */
export class SqlError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('SQL', message, options)
  }
}

/** A language-model call failed, timed out, or returned unusable output. */
export class LlmError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('LLM', message, { retryable: true, ...options })
  }
}

/** A safety, scope, or privacy guardrail blocked the operation. */
export class GuardrailError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('GUARDRAIL', message, options)
  }
}

/** Two pieces of evidence irreconcilably conflict. */
export class ConflictError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('CONFLICT', message, options)
  }
}

/** Configuration was missing or invalid (typically a boot-time failure). */
export class ConfigError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('CONFIG', message, options)
  }
}

/** An unexpected internal failure with no more specific code. */
export class InternalError extends AiError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super('INTERNAL', message, options)
  }
}

/** Type guard: is `value` an {@link AiError}? */
export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError
}
