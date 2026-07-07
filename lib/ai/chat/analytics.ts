/**
 * @module lib/ai/chat/analytics
 *
 * Product analytics + observability for the AI Counsellor. A parallel, privacy-safe sink
 * to the {@link ChatLogger} (which logs the request/LLM/response lifecycle). The Coordinator
 * emits typed {@link AnalyticsEvent}s so we can answer product questions after Beta —
 * capability usage, drop-off, comparisons, unsupported asks, fallback rate, confidence.
 *
 * PRIVACY (enforced by construction): events carry ONLY non-identifying signals —
 * capability/decision kinds, coarse enums (strategy, confidence LEVEL, topic), booleans,
 * counts, a random conversationId, and PUBLIC college names (the entity asked about, not
 * the student). They NEVER carry the raw message, a student name, or the cutoff / community
 * / district VALUES. This mirrors the logger's "length, never content" rule.
 */

import type { CounselorDecision } from './counselor-brain'

/** A single privacy-safe product/observability event. */
export type AnalyticsEvent =
  | { readonly type: 'conversation_started'; readonly conversationId: string }
  | { readonly type: 'profile_completed'; readonly conversationId: string }
  | { readonly type: 'capability_selected'; readonly conversationId: string; readonly capability: CounselorDecision['kind']; readonly isParent: boolean }
  | { readonly type: 'recommendation_requested'; readonly conversationId: string }
  | { readonly type: 'comparison_requested'; readonly conversationId: string; readonly colleges: readonly string[] }
  | { readonly type: 'knowledge_query'; readonly conversationId: string; readonly college: string | null }
  | { readonly type: 'preference_list_generated'; readonly conversationId: string }
  | { readonly type: 'parent_mode'; readonly conversationId: string }
  | { readonly type: 'honest_limitation'; readonly conversationId: string; readonly topic: string }
  | { readonly type: 'colleges_referenced'; readonly conversationId: string; readonly colleges: readonly string[] }
  | {
      readonly type: 'trust_outcome'
      readonly conversationId: string
      /** Reasoning strategy (e.g. eligibility_bands, comparison, college_recommendation). */
      readonly strategy: string
      /** Confidence LEVEL only (high/medium/low) — never a cutoff or numeric mark. */
      readonly confidence: string
      readonly usedModel: boolean
      readonly fallback: boolean
      readonly evidenceCount: number
    }
  | { readonly type: 'conversation_completed'; readonly conversationId: string; readonly turns: number }

/** Receives product/observability events. Side-effect only; never affects a response. */
export interface AnalyticsSink {
  track(event: AnalyticsEvent): void
}

/** A sink that emits one JSON line per event (production; scraped by the ops pipeline). */
export function createConsoleAnalytics(): AnalyticsSink {
  return Object.freeze({
    track: (event: AnalyticsEvent): void => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ scope: 'analytics', ...event }))
    },
  })
}

/** A sink that discards everything (tests / when analytics is disabled). */
export function createNullAnalytics(): AnalyticsSink {
  return Object.freeze({ track: () => undefined })
}

/** A sink that records events in memory (tests). */
export interface RecordingAnalytics extends AnalyticsSink {
  readonly events: readonly AnalyticsEvent[]
}

/** Create an in-memory recording analytics sink. */
export function createRecordingAnalytics(): RecordingAnalytics {
  const events: AnalyticsEvent[] = []
  return Object.freeze({
    track: (event: AnalyticsEvent) => void events.push(event),
    get events() {
      return events
    },
  })
}

/** Explicit conversation-closing cues (used to emit `conversation_completed`). */
const CLOSER_RE = /^(thanks?|thank you|thx|bye|goodbye|done|that'?s all|see you|ok thanks)[\s!.]*$/i

/** Whether a message is an explicit sign-off (privacy: returns a boolean, logs nothing). */
export function isClosingMessage(message: string): boolean {
  return CLOSER_RE.test(message.trim())
}

/** Inputs for deriving a turn's decision-phase events. */
export interface TurnAnalyticsInput {
  readonly conversationId: string
  readonly decision: CounselorDecision
  readonly isParent: boolean
  /** Resolved PUBLIC college names referenced this turn (never student data). */
  readonly colleges: readonly string[]
  readonly hasMultipleColleges: boolean
  readonly priorTurns: number
  readonly isCloser: boolean
}

/**
 * Map a turn's decision to its product events (pure; no I/O). `conversation_started`,
 * `honest_limitation` for domain/unverified declines, and `trust_outcome` are emitted
 * separately by the Coordinator where that context is available.
 */
export function turnAnalyticsEvents(input: TurnAnalyticsInput): AnalyticsEvent[] {
  const cid = input.conversationId
  const out: AnalyticsEvent[] = [{ type: 'capability_selected', conversationId: cid, capability: input.decision.kind, isParent: input.isParent }]
  if (input.isParent) out.push({ type: 'parent_mode', conversationId: cid })

  switch (input.decision.kind) {
    case 'onboardingSummary':
      out.push({ type: 'profile_completed', conversationId: cid })
      break
    case 'preferenceList':
      out.push({ type: 'preference_list_generated', conversationId: cid })
      out.push({ type: 'recommendation_requested', conversationId: cid })
      break
    case 'recommend':
    case 'tier':
    case 'refine':
    case 'profileChanged':
    case 'exclude':
      out.push({ type: 'recommendation_requested', conversationId: cid })
      break
    case 'answerQuestion':
      out.push({ type: 'knowledge_query', conversationId: cid, college: input.colleges[0] ?? null })
      break
    case 'compareNeedsTwo':
      out.push({ type: 'comparison_requested', conversationId: cid, colleges: input.colleges })
      break
    case 'dataDecline':
      out.push({ type: 'honest_limitation', conversationId: cid, topic: input.decision.topic })
      break
    case 'social':
      if (input.isCloser) out.push({ type: 'conversation_completed', conversationId: cid, turns: input.priorTurns })
      break
  }

  if (input.colleges.length > 0) out.push({ type: 'colleges_referenced', conversationId: cid, colleges: input.colleges })
  // A two-college mention is a comparison even when it routes through the answer path.
  if (input.hasMultipleColleges && input.decision.kind !== 'compareNeedsTwo') {
    out.push({ type: 'comparison_requested', conversationId: cid, colleges: input.colleges })
  }
  return out
}
