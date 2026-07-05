/**
 * @module lib/opinion/models/recommendation
 *
 * The structured OPINION object — a recommendation with its reasoning, the
 * evidence that backs it, confidence, trade-offs, and risks. These are generated
 * DETERMINISTICALLY from evidence (never by the LLM, never hardcoded); the LLM
 * only turns them into prose.
 */

import type { ConfidenceLevel } from '@/lib/ai/orchestration'
import type { RecommendationKind } from './enums'

/** A single grounded recommendation/opinion. */
export interface OpinionRecommendation {
  readonly id: string
  readonly kind: RecommendationKind
  /** College name(s) this recommendation concerns. */
  readonly colleges: readonly string[]
  /** A short structured headline (e.g. "Safe choices", "Best for placements"). */
  readonly headline: string
  /** Structured, grounded reasons (not prose paragraphs). */
  readonly reasoning: readonly string[]
  /** Evidence ids that support this recommendation. */
  readonly evidenceIds: readonly string[]
  readonly confidence: ConfidenceLevel
  /** Honest trade-offs (e.g. "stronger placements but less research"). */
  readonly tradeoffs: readonly string[]
  /** Risks/caveats (e.g. "admission not guaranteed", "eligibility unconfirmed"). */
  readonly risks: readonly string[]
}
