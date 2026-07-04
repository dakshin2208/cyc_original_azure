/**
 * @module lib/ai/shared/errors
 *
 * Barrel for the error hierarchy and error codes. Import errors from here
 * (or from the top-level `@/lib/ai/shared` barrel), never from the individual
 * files, so the public surface stays stable.
 */

export type { ErrorCode } from './error-codes'
export { ERROR_CODES } from './error-codes'
export type { AiErrorOptions, SerializedAiError } from './ai-error'
export {
  AiError,
  ValidationError,
  NotFoundError,
  AbstentionError,
  RetrievalError,
  SqlError,
  LlmError,
  GuardrailError,
  ConflictError,
  ConfigError,
  InternalError,
  isAiError,
} from './ai-error'
