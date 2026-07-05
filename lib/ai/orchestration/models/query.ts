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
  /**
   * A non-engineering domain the warehouse does not cover (medical/law/arts/…),
   * or `null` when the query is in-domain (engineering). Drives a scope decline.
   */
  readonly outOfDomain: string | null
  /**
   * True when the query names a college (a distinctive token alongside an
   * institution word) that could NOT be verified against the warehouse. Drives a
   * "couldn't verify that college" decline instead of a fuzzy mis-match.
   */
  readonly unverifiedCollege: boolean
}

/**
 * Profile-derived defaults that fill fields the CURRENT message did not specify
 * (e.g. a stored student profile). A field the message states always wins; these
 * only fill gaps. Used by the conversational layer — the recommendation engine is
 * unchanged and simply receives the merged query.
 */
export interface QueryOverrides {
  readonly studentCutoff?: number | null
  readonly community?: CommunityCode | null
  readonly branch?: string | null
  readonly location?: string | null
  /**
   * Canonical college names the student explicitly asked to exclude ("remove X").
   * The engine still RANKS every college (it stays the source of truth); the
   * orchestrator simply omits these from the results the student rejected — a
   * presentation-level constraint, never a change to the ranking itself.
   */
  readonly exclude?: readonly string[]
}
