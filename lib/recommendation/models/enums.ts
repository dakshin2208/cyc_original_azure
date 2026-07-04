/**
 * @module lib/recommendation/models/enums
 *
 * Closed vocabularies for the Recommendation Engine: scoring dimensions,
 * recommendation categories, eligibility categories, confidence levels, and
 * reason strengths. String-union + frozen list, matching the codebase style.
 */

/** The independent scoring dimensions a college is evaluated on. */
export const SCORE_DIMENSIONS = [
  'placement',
  'faculty',
  'research',
  'infrastructure',
  'financialStrength',
  'academicReputation',
  'nirfPresence',
  'availableBranches',
  'dataCompleteness',
] as const
/** A single scoring dimension. */
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number]

/** The recommendation intents / strategy categories. */
export const RECOMMENDATION_CATEGORIES = [
  'best_overall',
  'best_placement',
  'best_research',
  'best_faculty',
  'best_infrastructure',
  'best_roi',
  'higher_studies',
  'government_jobs',
  'private_college',
  'government_college',
  'by_branch',
  'by_cutoff',
] as const
/** A recommendation category. */
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number]

/** Admission eligibility classification for a student against a college. */
export const ELIGIBILITY_CATEGORIES = ['dream', 'reach', 'target', 'safe', 'unknown'] as const
/** A single eligibility category. */
export type EligibilityCategory = (typeof ELIGIBILITY_CATEGORIES)[number]

/** Human-facing confidence band. */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** The strength of a single recommendation reason. */
export type ReasonStrength = 'strong' | 'moderate' | 'weak'

/** Government vs private institute classification. */
export type InstituteType = 'government' | 'private'
