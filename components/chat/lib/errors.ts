/**
 * @module components/chat/lib/errors
 *
 * Maps HTTP statuses and thrown exceptions to normalized, user-friendly
 * {@link ChatApiError}s. Pure and deterministic; contains NO business logic and
 * NEVER surfaces internal details or stack traces.
 */

import type { ChatApiError, ChatErrorKind } from './types'

/** Friendly, display-safe copy for each error kind. */
export const USER_MESSAGE: Readonly<Record<ChatErrorKind, string>> = {
  validation: 'That request could not be processed. Please rephrase and try again.',
  unauthorized: 'Please sign in to chat with the AI counsellor.',
  limit_reached: "You've reached your plan's AI counsellor question limit. Upgrade your plan to ask more.",
  rate_limited: 'You are sending messages too quickly. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again.',
  unavailable: 'The assistant is temporarily unavailable. Please try again shortly.',
  timeout: 'The assistant took too long to respond. Please try again.',
  offline: 'You appear to be offline. Check your connection and try again.',
  network: 'We could not reach the assistant. Please check your connection and try again.',
  canceled: 'Request canceled.',
  unknown: 'An unexpected error occurred. Please try again.',
}

const RETRYABLE: ReadonlySet<ChatErrorKind> = new Set<ChatErrorKind>([
  'rate_limited',
  'server',
  'unavailable',
  'timeout',
  'offline',
  'network',
])

function make(kind: ChatErrorKind, httpStatus?: number, code?: string): ChatApiError {
  return { kind, message: USER_MESSAGE[kind], httpStatus, code, retryable: RETRYABLE.has(kind) }
}

/** Classify an HTTP error response. */
export function errorForStatus(status: number, body?: { code?: string }): ChatApiError {
  const code = body?.code
  switch (status) {
    case 400:
    case 422:
      return make('validation', status, code)
    case 401:
      return make('unauthorized', status, code)
    case 429:
      // A quota exhaustion (server code 'limit_reached') is distinct from rapid-fire
      // rate limiting: it is not retryable and prompts an upgrade, not a "wait".
      return make(code === 'limit_reached' ? 'limit_reached' : 'rate_limited', status, code)
    case 503:
      return make('unavailable', status, code)
    case 504:
      return make('timeout', status, code)
    default:
      if (status >= 500) return make('server', status, code)
      if (status >= 400) return make('validation', status, code)
      return make('unknown', status, code)
  }
}

const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false

/** Classify a thrown exception (network failure, timeout-abort, user cancel). */
export function errorForException(error: unknown, timedOut = false): ChatApiError {
  if (timedOut) return make('timeout')
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError') return make('canceled')
  // A failed fetch throws a TypeError ("Failed to fetch").
  if (error instanceof TypeError) return make(isOffline() ? 'offline' : 'network')
  return make('unknown')
}
