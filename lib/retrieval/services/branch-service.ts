/**
 * @module lib/retrieval/services/branch-service
 *
 * Branch Retrieval Service (Sprint 2 §2). Resolves any raw branch spelling to its
 * canonical branch (reusing the Phase 1 alias index) and searches similar names.
 */

import {
  type CanonicalBranch,
  type CanonicalBranchId,
  comparisonKey,
  type KnowledgeRepositories,
  normalizeBranch,
} from '@/lib/knowledge'
import type { RankedMatch } from '../models'
import { rankCandidates } from '../ranking'

/** Deterministic branch retrieval. */
export interface BranchRetrievalService {
  /** Resolve a raw branch spelling to its canonical branch, or `null`. */
  find(rawName: string): CanonicalBranch | null
  /** Alias resolution (alias of {@link find}). */
  resolveAlias(rawName: string): CanonicalBranch | null
  /** Get a canonical branch by id. */
  getCanonical(id: CanonicalBranchId): CanonicalBranch | null
  /** Search branches by name/alias similarity, ranked. */
  searchSimilar(query: string, limit?: number): readonly RankedMatch<CanonicalBranch>[]
}

/** Create the branch retrieval service over the Phase 1 repositories. */
export function createBranchService(repos: KnowledgeRepositories): BranchRetrievalService {
  const resolve = (rawName: string): CanonicalBranch | null => {
    // 1) Try the warehouse alias index (raw spellings observed in the data).
    const direct = repos.branches.resolve(rawName)
    if (direct) return direct
    // 2) Fall back to the curated normalizer (knows abbreviations like AI&DS/CSE),
    //    then match the resulting canonical name against the catalog.
    const canonicalKey = comparisonKey(normalizeBranch(rawName).canonicalName)
    return repos.branches.list().find((b) => comparisonKey(b.canonicalName) === canonicalKey) ?? null
  }

  return Object.freeze({
    find: resolve,
    resolveAlias: resolve,
    getCanonical: (id) => repos.branches.getById(id),
    searchSimilar: (query, limit = 5) =>
      rankCandidates(query, repos.branches.list(), {
        name: (b) => b.canonicalName,
        aliases: (b) => b.aliases,
        limit,
        includeFuzzy: true,
      }),
  })
}
