/**
 * @module lib/ai/orchestration/conversation/conversation-state
 *
 * Lightweight, session-scoped conversation state (Module 7). Immutable snapshots
 * advanced with {@link applyTurn}. Request/session scoped ONLY — no database, no
 * persistence, no long-term memory. Deterministic; no AI.
 */

import type { SessionId } from '@/lib/ai/shared'
import type { ContextPackage, ConversationState, ParsedQuery } from '../models'

const dedupe = (values: readonly string[]): readonly string[] => Array.from(new Set(values))

/** Create an empty conversation state for a session. */
export function createConversationState(sessionId: SessionId): ConversationState {
  return Object.freeze({
    sessionId,
    turnCount: 0,
    currentIntent: null,
    mentionedColleges: Object.freeze([]),
    mentionedBranches: Object.freeze([]),
    previousRecommendations: Object.freeze([]),
    previousComparisons: Object.freeze([]),
    clarificationRequests: Object.freeze([]),
  })
}

/**
 * Advance the state by one turn, returning a NEW immutable snapshot. Colleges and
 * branches accumulate (deduped); recommendations/comparisons record the latest
 * turn; clarifications accumulate. The previous state is never mutated.
 */
export function applyTurn(
  state: ConversationState,
  parsed: ParsedQuery,
  context: ContextPackage,
): ConversationState {
  const mentionedColleges = dedupe([...state.mentionedColleges, ...parsed.colleges])
  const mentionedBranches = dedupe([
    ...state.mentionedBranches,
    ...(parsed.branch ? [parsed.branch] : []),
  ])
  const previousRecommendations =
    context.recommendations.length > 0
      ? context.recommendations.map((r) => r.college.name)
      : state.previousRecommendations
  const previousComparisons = context.comparison
    ? [...state.previousComparisons, context.comparison.colleges.map((c) => c.name)]
    : state.previousComparisons
  const clarificationRequests =
    context.followUpQuestions.length > 0
      ? dedupe([...state.clarificationRequests, ...context.followUpQuestions.map((q) => q.question)])
      : state.clarificationRequests

  return Object.freeze({
    sessionId: state.sessionId,
    turnCount: state.turnCount + 1,
    currentIntent: parsed.intent,
    mentionedColleges,
    mentionedBranches,
    previousRecommendations,
    previousComparisons,
    clarificationRequests,
  })
}
