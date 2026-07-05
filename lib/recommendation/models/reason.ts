/**
 * @module lib/recommendation/models/reason
 *
 * Structured explanation DTOs. These are STRUCTURED OBJECTS, not natural-language
 * paragraphs — a future LLM turns them into prose; the engine only produces the
 * structure.
 */

import type { ConfidenceLevel, ReasonStrength, ScoreDimension } from './enums'

/** A single piece of supporting evidence. */
export interface RecommendationEvidence {
  readonly dimension: ScoreDimension
  readonly label: string
  readonly value: string | number | null
  readonly source: string
}

/** A structured reason backing a recommendation. */
export interface RecommendationReason {
  readonly dimension: ScoreDimension
  /** Short structured label (e.g. "Excellent placements"). */
  readonly summary: string
  readonly strength: ReasonStrength
  readonly evidence: readonly RecommendationEvidence[]
}

/** Confidence in a recommendation. */
export interface RecommendationConfidence {
  /** Confidence value in [0, 1]. */
  readonly value: number
  readonly level: ConfidenceLevel
  /** Data completeness that drove the confidence. */
  readonly dataCompleteness: number
  /** Machine-readable basis note. */
  readonly basis: string
}

/** The full structured explanation for a recommendation. */
export interface RecommendationExplanation {
  readonly headline: string
  readonly reasons: readonly RecommendationReason[]
  readonly confidence: RecommendationConfidence
}
