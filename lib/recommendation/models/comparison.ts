/**
 * @module lib/recommendation/models/comparison
 * College comparison result DTOs.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { ScoreDimension } from './enums'
import type { RecommendationScore } from './score'

/** A college paired with its overall score. */
export interface CollegeScoreEntry {
  readonly college: CanonicalCollege
  readonly score: RecommendationScore
}

/** One entity's value on a dimension within a comparison. */
export interface DimensionValue {
  readonly college: CanonicalCollege
  readonly normalized: number
  readonly raw: number | null
  readonly hasData: boolean
}

/** A single dimension compared across colleges, with its winner. */
export interface DimensionComparison {
  readonly dimension: ScoreDimension
  readonly winner: CanonicalCollege | null
  readonly values: readonly DimensionValue[]
}

/** A college's per-comparison strengths and weaknesses. */
export interface CollegeStrengths {
  readonly college: CanonicalCollege
  readonly strengths: readonly ScoreDimension[]
  readonly weaknesses: readonly ScoreDimension[]
}

/** A category (dimension) winner. */
export interface CategoryWinner {
  readonly dimension: ScoreDimension
  readonly winner: CanonicalCollege | null
}

/** The full result of comparing 2+ colleges. */
export interface ComparisonResult {
  readonly colleges: readonly CanonicalCollege[]
  /** Overall winner (highest total), or `null` on a tie/empty. */
  readonly winner: CanonicalCollege | null
  readonly scores: readonly CollegeScoreEntry[]
  /** Per-dimension comparison + winners (the "differences" + "score breakdown"). */
  readonly dimensions: readonly DimensionComparison[]
  /** Convenience list of per-dimension winners. */
  readonly categoryWinners: readonly CategoryWinner[]
  /** Per-college strengths and weaknesses. */
  readonly profiles: readonly CollegeStrengths[]
}
