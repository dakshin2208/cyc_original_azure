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
    lastDiscussedCollege: null,
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

  // The antecedent for a later "it" / "that one". Sources, in order:
  //   1. a turn that named EXACTLY ONE college — `parsed.colleges` only ever holds resolved,
  //      warehouse-verified names, so a phantom can never land here;
  //   2. otherwise the TOP PICK of a recommendation shown this turn (engine output);
  //   3. otherwise whatever was being discussed before.
  // A turn naming TWO+ colleges (a comparison) deliberately falls through to (2)/(3) rather
  // than picking one: "compare A and B" then "is it good?" is genuinely ambiguous, and a
  // silent choice would be a guess. Leaving it unchanged makes the counsellor ask instead.
  const named = parsed.colleges.length === 1 ? parsed.colleges[0] : null
  const lastDiscussedCollege =
    named ?? context.recommendations[0]?.college.name ?? state.lastDiscussedCollege ?? null

  return Object.freeze({
    sessionId: state.sessionId,
    turnCount: state.turnCount + 1,
    currentIntent: parsed.intent,
    mentionedColleges,
    mentionedBranches,
    previousRecommendations,
    previousComparisons,
    clarificationRequests,
    lastDiscussedCollege,
  })
}
