/**
 * @module lib/retrieval/ranking/ranker
 *
 * Deterministic candidate ranking (Sprint 2 §8). A candidate is scored by the
 * strongest of: exact → alias → prefix → partial → fuzzy, each with a fixed
 * confidence (fuzzy uses normalized edit similarity). Reuses `comparisonKey`
 * from the warehouse layer for normalization — no duplicate normalization logic.
 */

import { comparisonKey } from '@/lib/knowledge'
import type { MatchType, RankedMatch } from '../models/match'
import { similarity } from './similarity'

/** Minimum normalized similarity for a fuzzy match. */
export const FUZZY_THRESHOLD = 0.6

/** Fixed confidence scores per match type (fuzzy is computed). */
const SCORE: Readonly<Record<Exclude<MatchType, 'fuzzy'>, number>> = {
  exact: 1,
  alias: 0.95,
  prefix: 0.85,
  partial: 0.7,
}

/** The scoring outcome for one candidate. */
interface Scored {
  readonly score: number
  readonly matchType: MatchType
}

/**
 * Score a single candidate name (+ optional aliases) against a normalized query
 * key. Returns `null` when the candidate does not match at all.
 */
export function scoreCandidate(
  queryKey: string,
  name: string,
  aliases: readonly string[],
  includeFuzzy: boolean,
): Scored | null {
  const nameKey = comparisonKey(name)
  if (nameKey === queryKey) return { score: SCORE.exact, matchType: 'exact' }
  for (const alias of aliases) {
    if (comparisonKey(alias) === queryKey) return { score: SCORE.alias, matchType: 'alias' }
  }
  if (nameKey.startsWith(queryKey)) return { score: SCORE.prefix, matchType: 'prefix' }
  if (nameKey.includes(queryKey)) return { score: SCORE.partial, matchType: 'partial' }
  if (includeFuzzy) {
    let sim = similarity(queryKey, nameKey)
    // Prefix-aware: a short misspelled query ("kumaragru college") should still
    // match a longer name by comparing against its leading window.
    if (queryKey.length >= 4 && nameKey.length > queryKey.length) {
      sim = Math.max(sim, similarity(queryKey, nameKey.slice(0, queryKey.length)))
    }
    if (sim >= FUZZY_THRESHOLD) return { score: Math.min(0.9, Math.round(sim * 100) / 100), matchType: 'fuzzy' }
  }
  return null
}

/** Options for {@link rankCandidates}. */
export interface RankOptions<T> {
  /** Extract the primary name to score against. */
  readonly name: (item: T) => string
  /** Extract optional aliases (e.g. branch spellings). */
  readonly aliases?: (item: T) => readonly string[]
  /** Maximum results to return. */
  readonly limit?: number
  /** Whether to include fuzzy (misspelling) matches. Default `true`. */
  readonly includeFuzzy?: boolean
}

/**
 * Rank candidates against a query, returning matches sorted by score (desc) then
 * label (asc) for determinism.
 */
export function rankCandidates<T>(
  query: string,
  candidates: readonly T[],
  opts: RankOptions<T>,
): RankedMatch<T>[] {
  const queryKey = comparisonKey(query)
  if (queryKey === '') return []
  const includeFuzzy = opts.includeFuzzy ?? true

  const matches: RankedMatch<T>[] = []
  for (const item of candidates) {
    const label = opts.name(item)
    const scored = scoreCandidate(queryKey, label, opts.aliases ? opts.aliases(item) : [], includeFuzzy)
    if (scored) matches.push({ item, label, score: scored.score, matchType: scored.matchType })
  }

  matches.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return typeof opts.limit === 'number' ? matches.slice(0, opts.limit) : matches
}
