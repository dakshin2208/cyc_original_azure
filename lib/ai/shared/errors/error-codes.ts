/**
 * @module lib/ai/shared/errors/error-codes
 *
 * The closed set of machine-readable error codes for the AI platform.
 * Codes are stable identifiers used for logging, metrics, and mapping errors
 * to safe client responses at the Gateway boundary (Project Structure, doc 07 §12).
 */

/** Frozen list of all error codes — the single source of truth. */
export const ERROR_CODES = [
  /** Input failed validation (bad/absent arguments, malformed identifiers). */
  'VALIDATION',
  /** A requested entity (college, branch, record) does not exist. */
  'NOT_FOUND',
  /** The counselor deliberately declined to answer (a domain outcome). */
  'ABSTENTION',
  /** A retrieval operation (SQL or RAG facade) failed. */
  'RETRIEVAL',
  /** A structured-data (SQL) query failed or was rejected. */
  'SQL',
  /** A language-model call failed, timed out, or returned unusable output. */
  'LLM',
  /** A safety/scope/privacy guardrail blocked the operation. */
  'GUARDRAIL',
  /** Two pieces of evidence irreconcilably conflict. */
  'CONFLICT',
  /** Configuration was missing or invalid (typically a boot-time failure). */
  'CONFIG',
  /** An unexpected internal failure with no more specific code. */
  'INTERNAL',
] as const

/** A machine-readable, stable error code. */
export type ErrorCode = (typeof ERROR_CODES)[number]
