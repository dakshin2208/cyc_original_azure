/**
 * @module lib/knowledge/warehouse/warehouse
 *
 * The Canonical Knowledge Warehouse — one immutable, indexed, in-memory store of
 * every canonical model, plus the crosswalk, build statistics, and lookup
 * indexes that repositories serve from. This is the single artifact every future
 * retrieval engine consumes.
 */

import type { CsvRow } from '../csv'
import type {
  CanonicalBranchId,
  CanonicalCollegeId,
  CommunityCode,
  NirfId,
} from '../ids'
import type { Crosswalk } from '../mapping'
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
import type { ValidationIssue } from '../validation'

/** Parsed source rows required to build the warehouse. */
export interface RawSources {
  /** `tn_nirf_299_colleges.csv` rows. */
  readonly master: readonly CsvRow[]
  /** `institutions.csv` rows. */
  readonly institutions: readonly CsvRow[]
  /** Distinct raw TNEA branch names (e.g. from `Ftnea_cutoffs.csv`). */
  readonly tneaBranches: readonly string[]
  /** Distinct TNEA counselling codes (the admission-side universe). */
  readonly tneaCounsellingCodes: readonly string[]
  /** `placement_higher_studies.csv` rows. */
  readonly placement: readonly CsvRow[]
  /** `faculty.csv` rows. */
  readonly faculty: readonly CsvRow[]
  /** `sponsored_research.csv` rows. */
  readonly sponsoredResearch: readonly CsvRow[]
  /** `consultancy.csv` rows. */
  readonly consultancy: readonly CsvRow[]
  /** `ipr.csv` rows. */
  readonly ipr: readonly CsvRow[]
  /** `phd_graduated.csv` rows. */
  readonly phdGraduated: readonly CsvRow[]
  /** `financial_operational.csv` rows. */
  readonly financialOperational: readonly CsvRow[]
  /** `financial_capital.csv` rows. */
  readonly financialCapital: readonly CsvRow[]
}

/** Summary counts for a warehouse build. */
export interface WarehouseStatistics {
  readonly colleges: number
  readonly institutions: number
  readonly branches: number
  readonly communities: number
  readonly placements: number
  readonly faculty: number
  readonly research: number
  readonly finance: number
  /** Distinct NIRF ids linked to a college. */
  readonly nirfLinkedColleges: number
  /** NIRF ids shared by more than one distinct college (source data quality). */
  readonly nirfConflicts: number
  /** Fact rows whose `nirf_id` did not resolve to any college. */
  readonly orphanedFacts: number
  /** Colleges merged away as duplicates during unification. */
  readonly duplicatesRemoved: number
  /** Rows skipped for missing required fields. */
  readonly rowsSkipped: number
  /** Total data-quality issues collected. */
  readonly issues: number
}

/**
 * TNEA <-> NIRF bridge coverage. Per the audit, the sources contain no
 * `counselling_code -> nirf_id` mapping, so `bridgeCoveragePct` is expected to be
 * 0 until that dataset is supplied; the NIRF side is fully represented today.
 */
export interface CrosswalkCoverage {
  /** Distinct NIRF institutions (quality-side universe). */
  readonly nirfInstitutions: number
  /** Distinct TNEA counselling codes (admission-side universe). */
  readonly tneaCounsellingCodes: number
  /** NIRF institutions represented by a canonical college. */
  readonly nirfInstitutionsLinked: number
  /** Colleges carrying a NIRF linkage. */
  readonly collegesWithNirf: number
  /** Colleges carrying at least one TNEA counselling code. */
  readonly collegesWithCounselling: number
  /** Colleges bridged to BOTH systems (the crosswalk success count). */
  readonly fullyBridged: number
  /** NIRF institutions linked as a percentage of the NIRF universe. */
  readonly nirfLinkagePct: number
  /** Fully-bridged colleges as a percentage of the TNEA universe. */
  readonly bridgeCoveragePct: number
}

/** The build report accompanying a warehouse. */
export interface BuildReport {
  readonly statistics: WarehouseStatistics
  readonly coverage: CrosswalkCoverage
  readonly issues: readonly ValidationIssue[]
}

/** The immutable, indexed canonical warehouse. */
export interface CanonicalWarehouse {
  // ── Collections ────────────────────────────────────────────────────────────
  readonly colleges: readonly CanonicalCollege[]
  readonly institutions: readonly CanonicalInstitution[]
  readonly branches: readonly CanonicalBranch[]
  readonly communities: readonly CanonicalCommunity[]
  readonly placements: readonly CanonicalPlacement[]
  readonly faculty: readonly CanonicalFaculty[]
  readonly research: readonly CanonicalResearch[]
  readonly finance: readonly CanonicalFinance[]

  // ── Identity ────────────────────────────────────────────────────────────────
  readonly crosswalk: Crosswalk

  // ── Indexes ─────────────────────────────────────────────────────────────────
  readonly collegeById: ReadonlyMap<CanonicalCollegeId, CanonicalCollege>
  readonly collegeByNirf: ReadonlyMap<NirfId, CanonicalCollege>
  readonly institutionByNirf: ReadonlyMap<NirfId, CanonicalInstitution>
  readonly branchById: ReadonlyMap<CanonicalBranchId, CanonicalBranch>
  /** Comparison-key of any alias -> its canonical branch. */
  readonly branchByAlias: ReadonlyMap<string, CanonicalBranch>
  readonly communityByCode: ReadonlyMap<CommunityCode, CanonicalCommunity>
  readonly placementsByCollege: ReadonlyMap<CanonicalCollegeId, readonly CanonicalPlacement[]>
  readonly facultyByCollege: ReadonlyMap<CanonicalCollegeId, readonly CanonicalFaculty[]>
  readonly researchByCollege: ReadonlyMap<CanonicalCollegeId, readonly CanonicalResearch[]>
  readonly financeByCollege: ReadonlyMap<CanonicalCollegeId, readonly CanonicalFinance[]>

  // ── Metadata ────────────────────────────────────────────────────────────────
  readonly report: BuildReport
}
