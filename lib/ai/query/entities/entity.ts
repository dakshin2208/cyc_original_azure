/**
 * @module lib/ai/query/entities/entity
 *
 * The canonical entity model. Every extracted entity carries its type, the raw
 * matched text (`value`), a typed `normalizedValue`, and a confidence — exactly
 * the four properties the sprint requires. Typed aliases are provided for the
 * common entities; their normalized types reuse shared domain models so there is
 * no duplication. Models only.
 */

import type { CollegeRef, Community } from '@/lib/ai/shared'
import type { EntityType, Gender, InstituteType } from './entity-type'

/** A character span within the original query text. */
export interface TextSpan {
  /** Inclusive start offset. */
  readonly start: number
  /** Exclusive end offset. */
  readonly end: number
}

/**
 * A single extracted entity.
 * @typeParam T The normalized value type (defaults to `unknown`).
 */
export interface QueryEntity<T = unknown> {
  /** The entity type. */
  readonly type: EntityType
  /** The raw text as matched in the query. */
  readonly value: string
  /** The normalized, typed value, or `null` if normalization is pending/failed. */
  readonly normalizedValue: T | null
  /** Extraction/normalization confidence in [0, 1]. */
  readonly confidence: number
  /** Location of the match in the original text, when known. */
  readonly span: TextSpan | null
}

/** A college entity, normalized to a {@link CollegeRef}. */
export type CollegeEntity = QueryEntity<CollegeRef>
/** A community entity, normalized to a shared {@link Community}. */
export type CommunityEntity = QueryEntity<Community>
/** A gender entity, normalized to a {@link Gender}. */
export type GenderEntity = QueryEntity<Gender>
/** An institute-type entity. */
export type InstituteTypeEntity = QueryEntity<InstituteType>
/** A numeric entity (cutoff, rank, marks, fees, year). */
export type NumericEntity = QueryEntity<number>
/** A free-text entity whose normalized form is a canonical string (branch, district, …). */
export type TextEntity = QueryEntity<string>
