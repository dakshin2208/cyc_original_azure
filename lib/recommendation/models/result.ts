/**
 * @module lib/recommendation/models/result
 * The eligibility assessment and the top-level recommendation result.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { EligibilityCategory, RecommendationCategory } from './enums'
import type { RecommendationConfidence, RecommendationExplanation } from './reason'
import type { RecommendationScore } from './score'

/** A student's admission-eligibility assessment for a college. */
export interface EligibilityAssessment {
  readonly category: EligibilityCategory
  readonly studentCutoff: number
  /** Historical closing cutoff used, or `null` when unavailable. */
  readonly closingCutoff: number | null
  /** studentCutoff - closingCutoff, or `null`. */
  readonly margin: number | null
  readonly hasData: boolean
  readonly basis: string
}

/** A single ranked recommendation. */
export interface RecommendationResult {
  readonly college: CanonicalCollege
  readonly rank: number
  readonly category: RecommendationCategory
  readonly score: RecommendationScore
  readonly explanation: RecommendationExplanation
  readonly confidence: RecommendationConfidence
  /** Eligibility assessment, when a student cutoff/community was supplied. */
  readonly eligibility: EligibilityAssessment | null
  /** Caveats (e.g. "ROI ranked by return; fees unavailable"). */
  readonly notes: readonly string[]
}
