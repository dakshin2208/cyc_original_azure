/**
 * @module lib/opinion/models/enums
 *
 * Closed vocabularies for the Opinion & Recommendation Engine (Sprint 8). No AI.
 */

/** The counseling strategy chosen for a query. */
export const OPINION_STRATEGIES = [
  'college_recommendation',
  'branch_recommendation',
  'comparison',
  'eligibility_bands',
  'placement_focused',
  'research_focused',
  'faculty_focused',
  'budget_focused',
  'location_focused',
  'general_counseling',
  'insufficient_evidence',
] as const
export type OpinionStrategy = (typeof OPINION_STRATEGIES)[number]

/** The kind of a single recommendation object. */
export const RECOMMENDATION_KINDS = [
  'top_pick',
  'safe',
  'moderate',
  'dream',
  'alternative',
  'comparison',
  'insufficient',
] as const
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number]

/** A counseling priority a student may weight. */
export const PRIORITIES = ['overall', 'placement', 'research', 'faculty', 'budget', 'location'] as const
export type Priority = (typeof PRIORITIES)[number]
