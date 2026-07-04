/**
 * @module lib/ai/shared/contracts/recommendation
 *
 * The Recommendation engine's output — a ranked, decomposable, explainable
 * shortlist (Recommendation Engine, doc 04). Scores are transparent: every item
 * carries the signed factor contributions that produced its rank.
 */

import type { RiskTier, WeightProfile } from '../enums'
import type { CollegeRef } from './domain'
import type { Citation } from './evidence'

/**
 * One factor's signed contribution to an item's score. The sum of contributions
 * (plus bonuses/penalties) yields the item score — this is what makes the
 * ranking explainable rather than opaque (doc 04 §5.2).
 */
export interface FactorContribution {
  /** Factor key (e.g. `'placement_quality'`). */
  readonly factor: string
  /** The weight applied to this factor under the active profile. */
  readonly weight: number
  /** The factor's peer-normalized value in [0, 1]. */
  readonly normalized: number
  /** The signed contribution to the score (`weight * normalized`, direction-adjusted). */
  readonly contribution: number
  /** Whether the underlying value was imputed rather than observed. */
  readonly imputed: boolean
}

/** A single ranked recommendation with its full, auditable justification. */
export interface RecommendationItem {
  /** 1-based position in the ranked list. */
  readonly position: number
  /** The recommended college. */
  readonly college: CollegeRef
  /** The recommended branch. */
  readonly branch: string
  /** The composite score. */
  readonly score: number
  /** Admission risk tier (safe / target / reach). */
  readonly tier: RiskTier
  /** Recommendation confidence in [0, 1]. */
  readonly confidence: number
  /** Per-factor contributions that produced the score. */
  readonly contributions: readonly FactorContribution[]
  /** Sources backing the item's values. */
  readonly citations: readonly Citation[]
  /** Honest caveats (e.g. "cost not considered — no fee data"). */
  readonly caveats: readonly string[]
}

/**
 * The full recommendation result: the ranked items and the weight profile that
 * produced them (disclosed for global explainability, doc 04 §8.3).
 */
export interface Recommendations {
  /** The active weighting lens. */
  readonly weightProfile: WeightProfile
  /** Ranked recommendations, best first. */
  readonly ranked: readonly RecommendationItem[]
}
