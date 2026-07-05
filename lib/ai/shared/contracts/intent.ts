/**
 * @module lib/ai/shared/contracts/intent
 *
 * The structured routing decision produced by the Intent module — the entry
 * point of the reasoning pipeline (Reasoning Engine, doc 05 §3, stage ①).
 */

import type { CareerGoal, Community, DataNeed, IntentCategory, ReasoningMode } from '../enums'
import type { CollegeRef } from './domain'

/**
 * Entities/parameters extracted from the utterance. All fields are optional and
 * may be `null` when mentioned-but-unresolved; absence means "not mentioned".
 */
export interface ExtractedSlots {
  /** A rank the student stated. */
  readonly rank?: number | null
  /** A cutoff mark the student stated. */
  readonly cutoff?: number | null
  /** The reservation community, if stated. */
  readonly community?: Community | null
  /** A branch of interest (free text, e.g. `'CSE'`). */
  readonly branch?: string | null
  /** A district/location preference. */
  readonly district?: string | null
  /** A budget ceiling, if stated (₹/year). */
  readonly budget?: number | null
  /** Colleges referenced by the utterance (e.g. for comparison). */
  readonly collegeRefs?: readonly CollegeRef[]
  /** A stated career goal. */
  readonly careerGoal?: CareerGoal | null
}

/** Safety classification for a turn. */
export interface SafetyFlags {
  /** Whether the turn falls outside the counselor's scope. */
  readonly outOfScope: boolean
  /** Optional reason string when `outOfScope` is `true`. */
  readonly reason?: string
}

/**
 * The Intent module's decision for a turn: what was asked, which reasoning
 * strategies apply, which data surfaces are needed, and how confident the
 * classification is.
 */
export interface IntentResult {
  /** Primary question category. */
  readonly category: IntentCategory
  /** A finer-grained sub-intent label, when identifiable. */
  readonly subIntent: string | null
  /** Reasoning strategies the Planner should consider (may be multiple). */
  readonly reasoningModes: readonly ReasoningMode[]
  /** Which retrieval surface(s) the turn requires. */
  readonly dataNeed: DataNeed
  /** Entities/parameters extracted from the utterance. */
  readonly slots: ExtractedSlots
  /** Safety/scope classification. */
  readonly safety: SafetyFlags
  /** Classification confidence in the range [0, 1]. */
  readonly confidence: number
}
