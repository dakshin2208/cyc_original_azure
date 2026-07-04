/**
 * @module lib/ai/shared/contracts/response
 *
 * The final, UI-renderable answer produced by the Response Generator
 * (AI Architecture, doc 03 §15). Combines counselor-toned narrative with typed
 * structured blocks so the frontend can render tables, lists, and cards while
 * preserving citations and confidence.
 */

import type { ComparisonMatrix } from './comparison'
import type { ConfidenceScore } from './decision'
import type { EligibilityResult } from './eligibility'
import type { Citation } from './evidence'
import type { RecommendationItem } from './recommendation'

/** Free-form counselor prose rendered as Markdown. */
export interface TextBlock {
  readonly kind: 'text'
  /** Markdown content. */
  readonly markdown: string
}

/** A rendered eligibility list. */
export interface EligibilityBlock {
  readonly kind: 'eligibility_list'
  /** The eligibility result to render. */
  readonly result: EligibilityResult
}

/** A rendered comparison table. */
export interface ComparisonBlock {
  readonly kind: 'comparison_table'
  /** The comparison matrix to render. */
  readonly matrix: ComparisonMatrix
}

/** Rendered recommendation cards. */
export interface RecommendationBlock {
  readonly kind: 'recommendation_cards'
  /** The ranked items to render. */
  readonly items: readonly RecommendationItem[]
}

/** A rendered list of source citations. */
export interface CitationsBlock {
  readonly kind: 'citations'
  /** The citations to render. */
  readonly citations: readonly Citation[]
}

/** A discriminated union of all renderable response blocks. */
export type ResponseBlock =
  | TextBlock
  | EligibilityBlock
  | ComparisonBlock
  | RecommendationBlock
  | CitationsBlock

/** A suggested next question to drive the counseling flow forward. */
export interface FollowUp {
  /** Button/label text. */
  readonly label: string
  /** The prompt submitted if the user selects it. */
  readonly prompt: string
}

/**
 * The complete answer for a turn: narrative, structured blocks, citations,
 * confidence, and suggested follow-ups.
 */
export interface ResponsePayload {
  /** Counselor-toned narrative (Markdown). */
  readonly narrative: string
  /** Structured, renderable blocks. */
  readonly blocks: readonly ResponseBlock[]
  /** All sources cited in this answer. */
  readonly citations: readonly Citation[]
  /** The decision's confidence, surfaced to the user. */
  readonly confidence: ConfidenceScore
  /** Suggested follow-up questions. */
  readonly followUps: readonly FollowUp[]
}
