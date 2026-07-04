/**
 * @module lib/recommendation/models/score
 * Scoring result DTOs.
 */

import type { ScoreDimension } from './enums'

/** The score contribution of one dimension. */
export interface DimensionScore {
  readonly dimension: ScoreDimension
  /** The underlying raw metric, or `null` when unavailable. */
  readonly raw: number | null
  /** Normalized score in [0, 1]. */
  readonly normalized: number
  /** Weight applied (from config). */
  readonly weight: number
  /** `normalized * weight`. */
  readonly contribution: number
  /** Whether data backed this dimension. */
  readonly hasData: boolean
}

/** A college's complete weighted score. */
export interface RecommendationScore {
  /** Weighted average over dimensions with data, in [0, 1]. */
  readonly total: number
  /** Per-dimension breakdown. */
  readonly dimensions: readonly DimensionScore[]
  /** Fraction of dimensions backed by data, in [0, 1]. */
  readonly dataCompleteness: number
}
