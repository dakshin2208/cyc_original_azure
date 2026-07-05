/**
 * @module lib/recommendation/reasons/reason-generator
 *
 * The Recommendation Reason Generator (Module 6). Turns a computed score into
 * STRUCTURED reasons, evidence, and a confidence object — NOT natural-language
 * paragraphs. A future LLM converts these structures into prose; the engine never
 * writes free text and never reasons. Thresholds come from config. Deterministic.
 */

import type { RecommendationConfig } from '../config'
import {
  type CollegeProfile,
  type ConfidenceLevel,
  type RecommendationCategory,
  type RecommendationConfidence,
  type RecommendationExplanation,
  type RecommendationReason,
  type RecommendationScore,
  type ReasonStrength,
} from '../models'
import { evidenceFor } from './evidence'
import { CATEGORY_HEADLINE, DIMENSION_SUMMARY } from './labels'

/** Maximum number of reasons surfaced per explanation. */
const MAX_REASONS = 5

/** Builds structured explanations and confidence from scores. */
export interface ReasonGenerator {
  explain(
    profile: CollegeProfile,
    score: RecommendationScore,
    category: RecommendationCategory,
  ): RecommendationExplanation
  confidence(score: RecommendationScore): RecommendationConfidence
}

function strengthOf(normalized: number, strong: number, moderate: number): ReasonStrength {
  if (normalized >= strong) return 'strong'
  if (normalized >= moderate) return 'moderate'
  return 'weak'
}

function levelOf(value: number, high: number, medium: number): ConfidenceLevel {
  if (value >= high) return 'high'
  if (value >= medium) return 'medium'
  return 'low'
}

/** Create the reason generator bound to a resolved config. */
export function createReasonGenerator(config: RecommendationConfig): ReasonGenerator {
  const { strong, moderate } = config.reasons
  const { highThreshold, mediumThreshold } = config.confidence

  const confidence = (score: RecommendationScore): RecommendationConfidence => {
    const withData = score.dimensions.filter((d) => d.hasData).length
    const total = score.dimensions.length
    const value = score.dataCompleteness
    return {
      value,
      level: levelOf(value, highThreshold, mediumThreshold),
      dataCompleteness: value,
      basis: `data_completeness=${withData}/${total}`,
    }
  }

  const explain = (
    profile: CollegeProfile,
    score: RecommendationScore,
    category: RecommendationCategory,
  ): RecommendationExplanation => {
    // Rank dimensions with data by contribution (desc), then dimension name for
    // deterministic tie-breaks.
    const ranked = score.dimensions
      .filter((d) => d.hasData)
      .slice()
      .sort((a, b) => b.contribution - a.contribution || a.dimension.localeCompare(b.dimension))

    // Prefer dimensions that clear the "moderate" bar; if none do, keep the single
    // strongest so an explanation always has at least one concrete reason.
    const notable = ranked.filter((d) => d.normalized >= moderate)
    const chosen = (notable.length > 0 ? notable : ranked.slice(0, 1)).slice(0, MAX_REASONS)

    const reasons: RecommendationReason[] = chosen.map((d) => {
      const s = strengthOf(d.normalized, strong, moderate)
      return {
        dimension: d.dimension,
        summary: DIMENSION_SUMMARY[d.dimension][s],
        strength: s,
        evidence: evidenceFor(d.dimension, profile),
      }
    })

    return {
      headline: CATEGORY_HEADLINE[category],
      reasons,
      confidence: confidence(score),
    }
  }

  return Object.freeze({ explain, confidence })
}
