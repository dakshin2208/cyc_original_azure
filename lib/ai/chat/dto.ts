/**
 * @module lib/ai/chat/dto
 *
 * The HTTP-facing DTOs for the Chat API. Success and error bodies are distinct,
 * JSON-serializable shapes; `ChatOutcome` pairs a body with its HTTP status so the
 * Next.js route stays a one-liner. Pure data; no AI, no framework types.
 */

import type { ConfidenceLevel, FollowUpQuestion, ResponseCitation } from '@/lib/ai/orchestration'
import type { StudentProfileView } from './profile'

/** The request body accepted by `POST /api/chat`. */
export interface ChatRequest {
  readonly message: string
  readonly conversationId?: string
}

/** A successful chat response body. */
export interface ChatResponse {
  readonly answer: string
  readonly citations: readonly ResponseCitation[]
  readonly confidence: ConfidenceLevel
  readonly followUps: readonly FollowUpQuestion[]
  readonly conversationId: string
  /** The student profile captured so far — for the UI checklist (backend-driven). */
  readonly profile?: StudentProfileView
  /** Conversation stage: still `collecting` the profile, or `ready` to answer. */
  readonly stage?: 'collecting' | 'ready'
}

/** An error response body — safe, structured, never a stack trace. */
export interface ChatErrorBody {
  readonly error: string
  readonly code: string
  /** The conversation id, when one was established (else `null`). */
  readonly conversationId: string | null
  /** The safe fallback answer, when the pipeline produced one despite failing. */
  readonly answer?: string
  readonly followUps?: readonly FollowUpQuestion[]
}

/** A body + the HTTP status the route should send it with. */
export interface ChatOutcome {
  readonly httpStatus: number
  readonly body: ChatResponse | ChatErrorBody
}
