/**
 * @module lib/ai/shared/contracts/eligibility
 *
 * The Prediction engine's output — deterministic "can I get in?" results that
 * gate recommendation (Prediction Engine, doc 03 §8; Recommendation, doc 04 §2).
 */

import type { Community, GapToken, PredictionMode, RiskTier } from '../enums'
import type { CollegeRef } from './domain'

/** A probability band with its risk-tier label. */
export interface ProbabilityBand {
  /** Lower bound of admission probability, in [0, 1]. */
  readonly lower: number
  /** Upper bound of admission probability, in [0, 1]. */
  readonly upper: number
  /** The risk tier this band corresponds to. */
  readonly label: RiskTier
}

/** A single college-branch admission unit the student is eligible for. */
export interface EligibleOption {
  /** The college. */
  readonly college: CollegeRef
  /** The branch name. */
  readonly branch: string
  /** The community the eligibility was computed for. */
  readonly community: Community
  /** Safe / target / reach classification. */
  readonly tier: RiskTier
  /** Probability band, when computable; `null` if only a tier is known. */
  readonly probability: ProbabilityBand | null
  /** The historical closing mark/rank used, when available. */
  readonly closingValue: number | null
}

/**
 * The full eligibility result for a prediction request, including the structural
 * limitations that constrained its precision (e.g. `SEAT_MATRIX`).
 */
export interface EligibilityResult {
  /** Whether prediction ran in cutoff or rank mode. */
  readonly mode: PredictionMode
  /** Eligible options, typically ordered by fit. */
  readonly options: readonly EligibleOption[]
  /** Structural gaps that limited precision (disclosed, not hidden). */
  readonly limitations: readonly GapToken[]
}
