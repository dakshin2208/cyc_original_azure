/**
 * @module lib/ai/orchestration/models/conversation
 *
 * Lightweight, session-scoped conversation state DTO. Request/session scoped
 * ONLY — no database, no long-term memory, no persistence. Immutable snapshots.
 */

import type { SessionId } from '@/lib/ai/shared'
import type { QueryIntent } from './enums'

/** An immutable snapshot of the conversation so far (this session only). */
export interface ConversationState {
  readonly sessionId: SessionId
  /** Turns processed so far. */
  readonly turnCount: number
  /** Intent of the most recent turn. */
  readonly currentIntent: QueryIntent | null
  /** Distinct colleges mentioned across the session (first-seen order). */
  readonly mentionedColleges: readonly string[]
  /** Distinct branches mentioned across the session. */
  readonly mentionedBranches: readonly string[]
  /** College names from the most recent recommendation turn. */
  readonly previousRecommendations: readonly string[]
  /**
   * The single college the last answer was ABOUT — the antecedent a later "it" / "that one"
   * refers to. Set ONLY from a resolved, canonical college: a turn that named exactly one, or
   * the top pick of a recommendation. A turn that named TWO (a comparison) deliberately leaves
   * it untouched — picking one silently would be a guess. Never populated from a fuzzy match,
   * and never from a pronoun. `null` when nothing has been discussed yet, which is what makes
   * the counsellor ASK "which college?" instead of inventing one.
   */
  readonly lastDiscussedCollege: string | null
  /** College-name groups from prior comparison turns. */
  readonly previousComparisons: readonly (readonly string[])[]
  /** Clarifications requested (follow-up question texts already asked). */
  readonly clarificationRequests: readonly string[]
}
