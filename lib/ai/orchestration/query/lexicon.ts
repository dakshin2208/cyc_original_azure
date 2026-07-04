/**
 * @module lib/ai/orchestration/query/lexicon
 *
 * The injected, data-driven lexicon the entity extractor needs: a deterministic
 * college resolver (backed by the Sprint 2 retrieval fuzzy matcher) and the set
 * of known locations (cities/states from the warehouse). Injecting this keeps the
 * query module pure and unit-testable without the full warehouse.
 */

import type { CanonicalCollege, KnowledgeRepositories } from '@/lib/knowledge'
import type { RetrievalEngine } from '@/lib/retrieval'

/** A resolved college with the match score that produced it. */
export interface CollegeCandidate {
  readonly college: CanonicalCollege
  readonly score: number
}

/** Data-driven resolution used by the entity extractor. */
export interface QueryLexicon {
  /** Resolve a name fragment to ranked colleges (exact → partial → fuzzy). */
  resolveColleges(fragment: string, limit?: number): readonly CollegeCandidate[]
  /** Lower-cased known city + state names. */
  readonly locations: ReadonlySet<string>
}

/**
 * Build a {@link QueryLexicon} over the Phase 1 repositories + Sprint 2 retrieval
 * engine. Deterministic — reuses the existing fuzzy matcher; adds no new logic.
 */
export function createQueryLexicon(
  repos: KnowledgeRepositories,
  retrieval: RetrievalEngine,
): QueryLexicon {
  const locations = new Set<string>()
  for (const c of repos.colleges.list()) {
    if (c.city) locations.add(c.city.toLowerCase())
    if (c.state) locations.add(c.state.toLowerCase())
  }

  const resolveColleges = (fragment: string, limit = 3): readonly CollegeCandidate[] => {
    const trimmed = fragment.trim()
    if (trimmed.length < 3) return []
    const exact = retrieval.colleges.findByExactName(trimmed)
    if (exact) return [{ college: exact, score: 1 }]
    const partial = retrieval.colleges.findByPartialName(trimmed, limit)
    if (partial.length > 0) return partial.map((m) => ({ college: m.item, score: m.score }))
    return retrieval.colleges
      .findNearbyMatches(trimmed, limit)
      .map((m) => ({ college: m.item, score: m.score }))
  }

  return Object.freeze({ resolveColleges, locations })
}
