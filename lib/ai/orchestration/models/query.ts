/**
 * @module lib/ai/orchestration/models/query
 * The parsed-query DTO — the deterministic output of Query Understanding.
 */

import type { CommunityCode } from '@/lib/knowledge'
import type { ExtractedEntity } from './entities'
import type { QueryIntent } from './enums'

/** A normalized question with its detected intent and structured entities. */
export interface ParsedQuery {
  /** The original, untouched question. */
  readonly raw: string
  /** Lower-cased, whitespace-collapsed, punctuation-normalized text. */
  readonly normalized: string
  /** Whitespace tokens of {@link normalized}. */
  readonly tokens: readonly string[]
  /** The detected intent. */
  readonly intent: QueryIntent
  /** Intent confidence in [0, 1]. */
  readonly intentConfidence: number
  /** All extracted entities (colleges, branch, cutoff, community, …). */
  readonly entities: readonly ExtractedEntity[]
  /** Canonical college names mentioned (0..n), in first-seen order. */
  readonly colleges: readonly string[]
  /** Whether two or more distinct colleges were mentioned. */
  readonly hasMultipleColleges: boolean
  /** Canonical branch name, when one was mentioned. */
  readonly branch: string | null
  /** Reservation community, when mentioned. */
  readonly community: CommunityCode | null
  /** Student cutoff / score, when mentioned. */
  readonly studentCutoff: number | null
  /** Location (city/state), when mentioned. */
  readonly location: string | null
}
