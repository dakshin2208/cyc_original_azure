/**
 * @module lib/ai/shared/contracts/comparison
 *
 * The Comparison engine's normalized, multi-dimensional side-by-side output
 * (AI Architecture, doc 03 §7). Values are computed deterministically; the
 * verdict/opinion is produced later by the reasoning/LLM layer over this matrix.
 */

import type { GapToken } from '../enums'
import type { CollegeRef } from './domain'

/** Orientation of a comparison dimension — which direction counts as "better". */
export type DimensionDirection = 'higher_better' | 'lower_better' | 'closer_better'

/** One entity's value on one dimension, raw and peer-normalized. */
export interface DimensionValue {
  /** The college this value belongs to. */
  readonly college: CollegeRef
  /** The raw value (number, string, or `null` when unavailable). */
  readonly raw: number | string | null
  /** Peer-normalized score in [0, 1], or `null` when not comparable. */
  readonly normalized: number | null
}

/** A single comparison axis across all compared entities. */
export interface ComparisonDimension {
  /** Stable key (e.g. `'median_salary'`). */
  readonly key: string
  /** Human-readable label. */
  readonly label: string
  /** Which direction is "better" on this dimension. */
  readonly direction: DimensionDirection
  /** Each entity's value on this dimension. */
  readonly values: readonly DimensionValue[]
  /** The winning college on this dimension, or `null` if tied/undecidable. */
  readonly winner: CollegeRef | null
}

/**
 * A full comparison matrix: the entities compared, each dimension with its
 * per-entity values and winner, and any gaps that could not be compared.
 */
export interface ComparisonMatrix {
  /** The colleges being compared. */
  readonly entities: readonly CollegeRef[]
  /** The comparison dimensions. */
  readonly dimensions: readonly ComparisonDimension[]
  /** Structural gaps (e.g. `FEES`, `BRANCH_NIRF`) omitted from the comparison. */
  readonly gaps: readonly GapToken[]
}
