/**
 * @module lib/recommendation/data/profile-provider
 *
 * Assembles a {@link CollegeProfile} — one college joined with its placement,
 * finance, research, faculty, and NIRF facets — by REUSING the Sprint 2 Retrieval
 * Engine and the Phase 1 repositories. No aggregation logic is duplicated here;
 * every fact summary comes from the retrieval services. Profiles are memoized
 * (the warehouse is immutable) for deterministic, allocation-light scoring.
 */

import { communityCode, type CanonicalCollege, type KnowledgeRepositories } from '@/lib/knowledge'
import type { RetrievalEngine } from '@/lib/retrieval'
import type { RecommendationConfig } from '../config'
import type { CollegeProfile } from '../models'
import { classifyInstituteType } from './institute-type'

/** Provides assembled college profiles for scoring/comparison. */
export interface ProfileProvider {
  /** Assemble (and cache) the profile for a specific college. */
  getProfile(college: CanonicalCollege): CollegeProfile
  /** All college profiles in the warehouse. */
  listProfiles(): readonly CollegeProfile[]
  /** Profile for an exact (normalized) college name, or `null`. */
  getByExactName(name: string): CollegeProfile | null
  /** Best-effort profile lookup by name (partial → fuzzy), or `null`. */
  findByName(query: string): CollegeProfile | null
}

/** Create the profile provider over Phase 1 repositories + the Retrieval Engine. */
export function createProfileProvider(
  repos: KnowledgeRepositories,
  engine: RetrievalEngine,
  config: RecommendationConfig,
): ProfileProvider {
  const cache = new Map<string, CollegeProfile>()
  const OC = communityCode('OC')

  const assemble = (college: CanonicalCollege): CollegeProfile => {
    const nirf = college.nirfId
    const institution = nirf ? engine.institutions.getNirfInfo(nirf) : null
    return Object.freeze({
      college,
      institution,
      placement: engine.placements.getSummary(college.id),
      finance: engine.finance.getSummary(college.id),
      research: engine.research.getSummary(college.id),
      faculty: nirf ? engine.institutions.getFaculty(nirf) : null,
      instituteType: classifyInstituteType(college, institution, config.governmentKeywords),
      district: repos.colleges.districtOf(college.id),
      // Selectivity signal: the 2026 OC cutoff, falling back to the TNEA OC median so
      // colleges missing a 2026 cutoff (e.g. PSG) still get a selectivity score.
      ocCutoff: repos.colleges.ocCutoffOf(college.id) ?? repos.colleges.communityCutoffOf(college.id, OC),
      // The BRANDED CYC Power Score + its TN rank, straight from the warehouse. Never
      // derived from the engine's internal match score.
      powerScore: repos.colleges.powerScoreOf(college.id),
      powerScoreRank: repos.colleges.powerScoreRankOf(college.id),
      // Canonical branches this college offers — used to prefer colleges that actually
      // offer a requested branch (e.g. AI & DS) over ones that only offer generic CSE.
      branchesOffered: repos.colleges.branchesOffered(college.id),
    })
  }

  const getProfile = (college: CanonicalCollege): CollegeProfile => {
    const cached = cache.get(college.id)
    if (cached) return cached
    const profile = assemble(college)
    cache.set(college.id, profile)
    return profile
  }

  return Object.freeze({
    getProfile,
    listProfiles: () => repos.colleges.list().map(getProfile),
    getByExactName: (name) => {
      const college = engine.colleges.findByExactName(name)
      return college ? getProfile(college) : null
    },
    findByName: (query) => {
      const partial = engine.colleges.findByPartialName(query, 1)
      if (partial.length > 0) return getProfile(partial[0].item)
      const fuzzy = engine.colleges.findNearbyMatches(query, 1)
      return fuzzy.length > 0 ? getProfile(fuzzy[0].item) : null
    },
  })
}
