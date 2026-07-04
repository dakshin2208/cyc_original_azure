/**
 * @module lib/recommendation/models/request
 * The recommendation request DTO.
 */

import type { CommunityCode } from '@/lib/knowledge'
import type { RecommendationCategory } from './enums'

/** A structured request for recommendations. */
export interface RecommendationRequest {
  /** The recommendation intent/strategy. */
  readonly category: RecommendationCategory
  /** Maximum results to return. */
  readonly limit?: number
  /** Branch filter/context (canonical or raw name). */
  readonly branch?: string
  /** The student's cutoff mark (enables eligibility). */
  readonly studentCutoff?: number
  /** The student's reservation community (enables eligibility). */
  readonly community?: CommunityCode
  /** District filter — matched case-insensitively against the college's district. */
  readonly district?: string
  /**
   * When true, keep clearly-ineligible ("dream") colleges in the candidate set.
   * Used by the band strategies (dream/reach/…), which select a band themselves.
   * Default (false) excludes "dream" so a general recommendation never surfaces a
   * college the student cannot realistically get.
   */
  readonly includeIneligible?: boolean
}
