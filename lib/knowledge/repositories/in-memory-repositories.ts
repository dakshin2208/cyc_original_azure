/**
 * @module lib/knowledge/repositories/in-memory-repositories
 *
 * In-memory repository implementations backed by the {@link CanonicalWarehouse}
 * indexes — O(1) lookups, O(n) search. Constructed once per warehouse.
 */

import type { CanonicalCollegeId } from '../ids'
import { comparisonKey } from '../normalization'
import { slugify } from '../ids'
import type { CanonicalWarehouse } from '../warehouse'
import type { KnowledgeRepositories } from './repository-interfaces'

/**
 * Create the full set of read-only repositories over a warehouse.
 * @param warehouse The built canonical warehouse.
 */
export function createRepositories(warehouse: CanonicalWarehouse): KnowledgeRepositories {
  const byCollege = <T>(index: ReadonlyMap<CanonicalCollegeId, readonly T[]>) => ({
    byCollege: (collegeId: CanonicalCollegeId): readonly T[] => index.get(collegeId) ?? [],
  })

  // Tamil Nadu rank BY CYC Power Score, computed once (deterministic: descending score,
  // ties broken by college id so the order is stable). Colleges with no Power Score are
  // unranked (absent from the map) — they are never given a fabricated position.
  const powerScoreRank = new Map<CanonicalCollegeId, number>()
  const scored = warehouse.colleges
    .map((c) => ({ id: c.id, score: warehouse.nirf2026.byCollege.get(c.id)?.powerScore ?? null }))
    .filter((x): x is { id: CanonicalCollegeId; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  scored.forEach((x, i) => powerScoreRank.set(x.id, i + 1))

  return Object.freeze({
    colleges: {
      getById: (id) => warehouse.collegeById.get(id) ?? null,
      getByNirfId: (nirf) => warehouse.collegeByNirf.get(nirf) ?? null,
      findByNameSlug: (slug) => warehouse.crosswalk.resolveByNameSlug(slug),
      search: (query) => {
        const needle = slugify(query)
        if (needle === '') return []
        return warehouse.colleges.filter((c) => c.nameSlug.includes(needle))
      },
      list: () => warehouse.colleges,
      districtOf: (id) => warehouse.nirf2026.byCollege.get(id)?.district ?? null,
      ocCutoffOf: (id) => warehouse.nirf2026.byCollege.get(id)?.ocCutoff ?? null,
      powerScoreOf: (id) => warehouse.nirf2026.byCollege.get(id)?.powerScore ?? null,
      powerScoreRankOf: (id) => powerScoreRank.get(id) ?? null,
      communityCutoffOf: (id, community) => {
        const code = warehouse.nirf2026.byCollege.get(id)?.collegeCode
        if (!code) return null
        return warehouse.communityCutoffs.get(code)?.[community] ?? null
      },
    },

    branches: {
      getById: (id) => warehouse.branchById.get(id) ?? null,
      resolve: (rawName) => warehouse.branchByAlias.get(comparisonKey(rawName)) ?? null,
      list: () => warehouse.branches,
    },

    communities: {
      getByCode: (code) => warehouse.communityByCode.get(code) ?? null,
      list: () => warehouse.communities,
    },

    institutions: {
      getByNirfId: (nirf) => warehouse.institutionByNirf.get(nirf) ?? null,
      list: () => warehouse.institutions,
    },

    placements: { ...byCollege(warehouse.placementsByCollege), list: () => warehouse.placements },
    faculty: { ...byCollege(warehouse.facultyByCollege), list: () => warehouse.faculty },
    research: { ...byCollege(warehouse.researchByCollege), list: () => warehouse.research },
    finance: { ...byCollege(warehouse.financeByCollege), list: () => warehouse.finance },
  })
}
