/**
 * @module lib/recommendation/scoring/scoring-engine
 *
 * The College Scoring Engine (Module 2). Produces a weighted, multi-dimensional
 * score for a college profile. Each of the nine dimensions is computed
 * INDEPENDENTLY from its own raw metrics; the total is a weighted average over
 * ONLY the dimensions that have data (graceful renormalization — missing data
 * never counts as a zero). Weights are supplied by the caller (strategies pass
 * their own profile), so nothing is hardcoded. Fully deterministic; no AI.
 */

import type { DimensionWeights, RecommendationConfig } from '../config'
import {
  SCORE_DIMENSIONS,
  type CollegeProfile,
  type DimensionScore,
  type RecommendationScore,
} from '../models'
import { EXTRACTORS } from './normalizers'

/** Computes weighted, renormalized college scores. */
export interface ScoringEngine {
  /** Score a profile using the given per-dimension weights. */
  score(profile: CollegeProfile, weights: DimensionWeights): RecommendationScore
  /** Score using the default (best-overall) weights. */
  scoreDefault(profile: CollegeProfile): RecommendationScore
}

/** Create the scoring engine bound to a resolved config. */
export function createScoringEngine(config: RecommendationConfig): ScoringEngine {
  const refs = config.normalization

  const score = (profile: CollegeProfile, weights: DimensionWeights): RecommendationScore => {
    const dimensions: DimensionScore[] = SCORE_DIMENSIONS.map((dimension) => {
      const { raw, value } = EXTRACTORS[dimension](profile, refs)
      const hasData = value !== null
      const normalized = value ?? 0
      const weight = weights[dimension]
      return {
        dimension,
        raw,
        normalized,
        weight,
        contribution: hasData ? normalized * weight : 0,
        hasData,
      }
    })

    // Weighted average over the FULL weight of all dimensions: a missing dimension
    // contributes 0 but its weight stays in the denominator, so sparse data dilutes the
    // score instead of being renormalized away (which used to reward missing data). A
    // college is credited only for what it can evidence.
    let weightedSum = 0
    let totalWeight = 0
    let withData = 0
    for (const d of dimensions) {
      totalWeight += d.weight
      if (d.hasData) {
        weightedSum += d.contribution
        withData += 1
      }
    }
    const total = totalWeight > 0 ? weightedSum / totalWeight : 0

    return {
      total,
      dimensions,
      dataCompleteness: withData / dimensions.length,
    }
  }

  return Object.freeze({
    score,
    scoreDefault: (profile) => score(profile, config.weights),
  })
}
