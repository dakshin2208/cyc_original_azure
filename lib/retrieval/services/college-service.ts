/**
 * @module lib/retrieval/services/college-service
 *
 * College Retrieval Service (Sprint 2 §1). Deterministic lookups over the Phase 1
 * college repository — exact/partial/fuzzy name, NIRF id, and counselling code.
 */

import {
  type CanonicalCollege,
  type CounsellingCode,
  type KnowledgeRepositories,
  type NirfId,
  slugify,
} from '@/lib/knowledge'
import type { RankedMatch } from '../models'
import { rankCandidates } from '../ranking'

/** Deterministic college retrieval. */
export interface CollegeRetrievalService {
  /** Exact name match (normalized), or `null`. */
  findByExactName(name: string): CanonicalCollege | null
  /** Partial (prefix/substring) name matches, ranked. */
  findByPartialName(query: string, limit?: number): readonly RankedMatch<CanonicalCollege>[]
  /** Lookup by TNEA counselling code (empty today — no bridge in the sources). */
  findByCounsellingCode(code: CounsellingCode): CanonicalCollege | null
  /** Lookup by NIRF id. */
  findByNirfId(nirf: NirfId): CanonicalCollege | null
  /** Fuzzy nearby matches (handles misspellings), ranked. */
  findNearbyMatches(query: string, limit?: number): readonly RankedMatch<CanonicalCollege>[]
}

/** Create the college retrieval service over the Phase 1 repositories. */
export function createCollegeService(repos: KnowledgeRepositories): CollegeRetrievalService {
  const all = (): readonly CanonicalCollege[] => repos.colleges.list()
  const byName = (c: CanonicalCollege): string => c.name

  return Object.freeze({
    findByExactName: (name) => {
      const slug = slugify(name)
      const direct = repos.colleges.findByNameSlug(slug)
      if (!direct) return null
      // Among same-named entities (base-warehouse duplicates, e.g. the two CIT records),
      // prefer the one with real data — a known cutoff, else placement — so a user naming
      // a college is matched to the data-bearing record, not an empty stub.
      const sameName = all().filter((c) => c.nameSlug === slug)
      if (sameName.length <= 1) return direct
      return (
        sameName.find((c) => repos.colleges.ocCutoffOf(c.id) != null) ??
        sameName.find((c) => repos.placements.byCollege(c.id).length > 0) ??
        direct
      )
    },

    findByPartialName: (query, limit) =>
      rankCandidates(query, all(), { name: byName, limit, includeFuzzy: false }),

    findByCounsellingCode: (code) =>
      all().find((c) => c.counsellingCodes.includes(code)) ?? null,

    findByNirfId: (nirf) => repos.colleges.getByNirfId(nirf),

    findNearbyMatches: (query, limit = 5) =>
      rankCandidates(query, all(), { name: byName, limit, includeFuzzy: true }),
  })
}
