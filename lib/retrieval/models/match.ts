/**
 * @module lib/retrieval/models/match
 *
 * Retrieval result DTOs for ranked matching. These are the retrieval layer's own
 * response types — consumers never see warehouse internals.
 */

/** Why a candidate matched, most-to-least confident. */
export type MatchType = 'exact' | 'alias' | 'prefix' | 'partial' | 'fuzzy'

/**
 * A single ranked match.
 * @typeParam T The matched item type.
 */
export interface RankedMatch<T> {
  /** The matched item. */
  readonly item: T
  /** The label (name) the match was scored against. */
  readonly label: string
  /** Confidence score in [0, 1]. */
  readonly score: number
  /** Why it matched. */
  readonly matchType: MatchType
}

/** A search response: the query, its ranked matches, and the total count. */
export interface SearchResult<T> {
  /** The original query. */
  readonly query: string
  /** Ranked matches, best first. */
  readonly matches: readonly RankedMatch<T>[]
  /** Number of matches returned. */
  readonly total: number
}
