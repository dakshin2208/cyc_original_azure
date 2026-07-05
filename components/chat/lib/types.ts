/**
 * @module components/chat/lib/types
 *
 * Client-side chat types. The backend HTTP-contract shapes are REUSED (type-only,
 * fully erased at build) from the Sprint 4/6 modules so the UI never redefines or
 * duplicates business types. No runtime coupling to the backend — the UI talks to
 * it exclusively over `POST /api/chat`.
 */

import type { ChatResponse, ChatErrorBody } from '@/lib/ai/chat'
import type { ConfidenceLevel, FollowUpQuestion, ResponseCitation } from '@/lib/ai/orchestration'

export type { ChatResponse, ChatErrorBody, ConfidenceLevel, FollowUpQuestion, ResponseCitation }

/** Who authored a rendered message. */
export type MessageRole = 'user' | 'assistant' | 'system'

/** Lifecycle of a rendered message. */
export type MessageStatus = 'sending' | 'complete' | 'error'

/** Normalized, user-facing API error (no stack traces, no internals). */
export interface ChatApiError {
  readonly kind: ChatErrorKind
  /** A friendly, display-safe message. */
  readonly message: string
  readonly httpStatus?: number
  /** The backend `code`, when the body carried one. */
  readonly code?: string
  /** Whether a retry could plausibly succeed. */
  readonly retryable: boolean
}

/** The classes of failure the client distinguishes. */
export type ChatErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'limit_reached'
  | 'rate_limited'
  | 'server'
  | 'unavailable'
  | 'timeout'
  | 'offline'
  | 'network'
  | 'canceled'
  | 'unknown'

/** A single message in the conversation (the UI's unit of state). */
export interface ChatMessage {
  readonly id: string
  readonly role: MessageRole
  /** Markdown for assistant/system messages; plain text for user messages. */
  readonly content: string
  readonly status: MessageStatus
  readonly createdAt: number
  readonly citations?: readonly ResponseCitation[]
  readonly followUps?: readonly FollowUpQuestion[]
  readonly confidence?: ConfidenceLevel
  /** Present only on an errored assistant turn. */
  readonly error?: ChatApiError
}
