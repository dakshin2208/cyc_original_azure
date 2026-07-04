/**
 * @module lib/ai/query/entities/entity-type
 *
 * The catalog of entity types the extractor may recognize in a college-counselor
 * query. Value list + derived union — a model, not logic. Extend centrally here.
 */

/** All recognized entity types (frozen single source of truth). */
export const ENTITY_TYPES = [
  'college',
  'branch',
  'course',
  'category',
  'community',
  'gender',
  'district',
  'state',
  'location',
  'quota',
  'reservation',
  'round',
  'counselling_phase',
  'cutoff',
  'rank',
  'marks',
  'fees',
  'year',
  'institute_type',
  'document',
  'preference',
] as const

/** A single recognized entity type. */
export type EntityType = (typeof ENTITY_TYPES)[number]

/** Gender values recognized as a `gender` entity. */
export type Gender = 'male' | 'female' | 'other'

/** Institute-type values recognized as an `institute_type` entity. */
export type InstituteType = 'government' | 'government_aided' | 'self_financing' | 'university' | 'deemed'
