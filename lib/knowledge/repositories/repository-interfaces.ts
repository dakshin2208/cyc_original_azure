/**
 * @module lib/knowledge/repositories/repository-interfaces
 *
 * Read-only repository contracts over the canonical warehouse. These are the
 * stable surface every future retrieval engine consumes — callers never touch
 * the warehouse internals directly. Synchronous (the warehouse is in-memory).
 */

import type {
  CanonicalBranchId,
  CanonicalCollegeId,
  CommunityCode,
  NirfId,
} from '../ids'
import type {
  CanonicalBranch,
  CanonicalCollege,
  CanonicalCommunity,
  CanonicalFaculty,
  CanonicalFinance,
  CanonicalInstitution,
  CanonicalPlacement,
  CanonicalResearch,
} from '../models'

/** Access to canonical colleges. */
export interface CollegeRepository {
  getById(id: CanonicalCollegeId): CanonicalCollege | null
  getByNirfId(nirf: NirfId): CanonicalCollege | null
  findByNameSlug(slug: string): CanonicalCollege | null
  /** Substring/slug search over college names. */
  search(query: string): readonly CanonicalCollege[]
  list(): readonly CanonicalCollege[]
  /** District (from the 2026 enrichment dataset) for a college, or `null` if unknown. */
  districtOf(id: CanonicalCollegeId): string | null
  /** OC closing cutoff (from the 2026 enrichment dataset) for a college, or `null` if unknown. */
  ocCutoffOf(id: CanonicalCollegeId): number | null
  /**
   * The CYC Power Score [0,100] (the 4-vector percentile composite, from the 2026
   * dataset), or `null` when the college has none on file. This is the BRANDED score —
   * distinct from the recommendation engine's internal match score.
   */
  powerScoreOf(id: CanonicalCollegeId): number | null
  /**
   * 1-based Tamil Nadu rank BY CYC Power Score (1 = highest), or `null` when the college
   * has no Power Score. Ranked by the same number it is displayed with, so rank and score
   * are always consistent.
   */
  powerScoreRankOf(id: CanonicalCollegeId): number | null
  /**
   * College-level median closing cutoff for a specific community (from the TNEA cutoff
   * dataset), or `null` if unknown. Lets a reserved student be judged on their OWN
   * community's marks rather than the OC band.
   */
  communityCutoffOf(id: CanonicalCollegeId, community: CommunityCode): number | null
  /**
   * The set of CANONICAL branch names this college offers (from the TNEA cutoff dataset),
   * or an empty set when unknown. Lets the engine prefer colleges that actually offer a
   * requested branch (e.g. "Artificial Intelligence and Data Science").
   */
  branchesOffered(id: CanonicalCollegeId): ReadonlySet<string>
}

/** Access to canonical branches. */
export interface BranchRepository {
  getById(id: CanonicalBranchId): CanonicalBranch | null
  /** Resolve any raw branch spelling to its canonical branch. */
  resolve(rawName: string): CanonicalBranch | null
  list(): readonly CanonicalBranch[]
}

/** Access to canonical communities. */
export interface CommunityRepository {
  getByCode(code: CommunityCode): CanonicalCommunity | null
  list(): readonly CanonicalCommunity[]
}

/** Access to canonical institutions. */
export interface InstitutionRepository {
  getByNirfId(nirf: NirfId): CanonicalInstitution | null
  list(): readonly CanonicalInstitution[]
}

/** Access to canonical placement records. */
export interface PlacementRepository {
  byCollege(collegeId: CanonicalCollegeId): readonly CanonicalPlacement[]
  list(): readonly CanonicalPlacement[]
}

/** Access to canonical faculty records. */
export interface FacultyRepository {
  byCollege(collegeId: CanonicalCollegeId): readonly CanonicalFaculty[]
  list(): readonly CanonicalFaculty[]
}

/** Access to canonical research records. */
export interface ResearchRepository {
  byCollege(collegeId: CanonicalCollegeId): readonly CanonicalResearch[]
  list(): readonly CanonicalResearch[]
}

/** Access to canonical finance records. */
export interface FinanceRepository {
  byCollege(collegeId: CanonicalCollegeId): readonly CanonicalFinance[]
  list(): readonly CanonicalFinance[]
}

/** The full set of warehouse repositories. */
export interface KnowledgeRepositories {
  readonly colleges: CollegeRepository
  readonly branches: BranchRepository
  readonly communities: CommunityRepository
  readonly institutions: InstitutionRepository
  readonly placements: PlacementRepository
  readonly faculty: FacultyRepository
  readonly research: ResearchRepository
  readonly finance: FinanceRepository
}
