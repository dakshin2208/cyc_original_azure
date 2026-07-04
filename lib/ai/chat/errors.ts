/**
 * @module lib/ai/chat/errors
 *
 * Chat-layer error taxonomy + HTTP status mapping. Every failure the route can
 * encounter maps to a stable code and a proper status code. Messages are safe
 * (no internals, no stack traces). No AI.
 */

import type { LLMResponseStatus } from '@/lib/ai/llm'

/** Stable, client-facing error codes. */
export type ChatErrorCode =
  | 'invalid_request'
  | 'empty_message'
  | 'message_too_long'
  | 'provider_unavailable'
  | 'timeout'
  | 'upstream_invalid'
  | 'internal_error'

/** HTTP status for each error code. */
export const HTTP_STATUS: Readonly<Record<ChatErrorCode, number>> = {
  invalid_request: 400,
  empty_message: 400,
  message_too_long: 413,
  provider_unavailable: 503,
  timeout: 504,
  upstream_invalid: 502,
  internal_error: 500,
}

/** Safe, client-facing message for each error code. */
export const SAFE_MESSAGE: Readonly<Record<ChatErrorCode, string>> = {
  invalid_request: 'Request body must be a JSON object with a "message" string.',
  empty_message: 'The "message" field must not be empty.',
  message_too_long: 'The "message" field is too long.',
  provider_unavailable: 'The AI provider is not available. Please try again later.',
  timeout: 'The request timed out. Please try again.',
  upstream_invalid: 'The AI response could not be validated. Please try again.',
  internal_error: 'An unexpected error occurred.',
}

/** Raised (and caught in the service) when the provider call exceeds the budget. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`operation exceeded ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/** Raised by the composition root when required configuration is missing. */
export class ChatConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatConfigError'
  }
}

/**
 * Map a non-success LLM pipeline status to a chat error code. `ok`/`repaired`
 * are successes and never reach here.
 */
export function errorCodeForLLMStatus(status: LLMResponseStatus): ChatErrorCode {
  switch (status) {
    case 'provider_error':
      return 'provider_unavailable'
    case 'unparseable':
    case 'rejected':
      return 'upstream_invalid'
    default:
      return 'internal_error'
  }
}
