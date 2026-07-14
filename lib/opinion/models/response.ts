/**
 * @module lib/opinion/models/response
 * The opinion response contract + per-call request options.
 */

import type { LLMResponseStatus } from '@/lib/ai/llm'
import type {
  ConfidenceLevel,
  FollowUpQuestion,
  QueryOverrides,
  ResponseCitation,
} from '@/lib/ai/orchestration'
import type { DiscardCode } from '../validator/opinion-validator'
import type { OpinionStrategy, Priority, RecommendationKind } from './enums'

/** One condensed line of the deterministic recommendation summary. */
export interface RecommendationSummaryItem {
  readonly kind: RecommendationKind
  readonly headline: string
  readonly colleges: readonly string[]
  readonly confidence: ConfidenceLevel
}

/** The final, formatted opinion response (the response contract). */
export interface OpinionResponse {
  /** Counselor-style answer — the LLM's phrasing, or a deterministic fallback. */
  readonly answer: string
  /** Citations for the facts used (only backend-supplied evidence). */
  readonly evidence: readonly ResponseCitation[]
  readonly confidence: ConfidenceLevel
  readonly followUps: readonly FollowUpQuestion[]
  /** The always-present, deterministic, grounded recommendation summary. */
  readonly recommendationSummary: readonly RecommendationSummaryItem[]
  readonly strategy: OpinionStrategy
  /** Whether the LLM answer was accepted (`true`) or a fallback was used (`false`). */
  readonly usedModel: boolean

  // ── Trust observability (emit-safe; see the trust_outcome analytics event) ────────────
  // `usedModel` alone cannot tell a clean model from one the guard is constantly saving:
  // a REPAIRED answer (guard stripped ungrounded sentences) still ships with usedModel=true.
  // These three make that countable on live traffic. All are closed enums or counts — no
  // model prose, no sentence text, no student data.

  /** How the LLM pipeline resolved this turn — `'not_attempted'` when it was never called. */
  readonly llmStatus: LLMResponseStatus | 'not_attempted'
  /** Why the model's prose was rejected (empty when it was accepted). Stable codes only. */
  readonly discardReasons: readonly DiscardCode[]
  /** How many sentences the hallucination guard stripped. The COUNT only — never the text. */
  readonly repairedSentenceCount: number
}

/** A minimal prior-turn record for conversation continuity. */
export interface ConversationTurn {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** Per-call options. */
export interface OpinionOptions {
  readonly priorities?: readonly Priority[]
  readonly limit?: number
  readonly history?: readonly ConversationTurn[]
  /** Optional system-prompt override for the counselor LLM (default: the built-in). */
  readonly systemPrompt?: string
  /** Profile-derived defaults that fill fields the message did not state. */
  readonly overrides?: QueryOverrides
}
