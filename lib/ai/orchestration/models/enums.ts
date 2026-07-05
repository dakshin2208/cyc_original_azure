/**
 * @module lib/ai/orchestration/models/enums
 *
 * Closed vocabularies for the AI Orchestration Layer: query intents, entity
 * types, evidence sources, and severity levels. Deterministic string-unions +
 * frozen lists. No AI.
 */

/** Supported query intents. `unknown` is the explicit no-signal fallback. */
export const QUERY_INTENTS = [
  'recommend_college',
  'compare_colleges',
  'branch_advice',
  'placement_query',
  'research_query',
  'faculty_query',
  'roi_query',
  'nirf_query',
  'cutoff_query',
  'eligibility_query',
  'general_information',
  'unknown',
] as const
/** A single query intent. */
export type QueryIntent = (typeof QUERY_INTENTS)[number]

/** The kinds of entity the extractor can identify in a question. */
export const ENTITY_TYPES = [
  'college',
  'branch',
  'cutoff',
  'community',
  'category',
  'score',
  'nirf_rank',
  'fees',
  'placements',
  'scholarship',
  'location',
] as const
/** A single entity type. */
export type EntityType = (typeof ENTITY_TYPES)[number]

/** Where a piece of evidence originated. */
export const EVIDENCE_SOURCES = ['recommendation', 'comparison', 'retrieval', 'warehouse'] as const
/** A single evidence source. */
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number]

/** Severity of a missing-information gap. */
export type MissingSeverity = 'blocking' | 'degraded' | 'informational'

/** Confidence band, mirroring the recommendation engine's vocabulary. */
export type ConfidenceLevel = 'high' | 'medium' | 'low'
