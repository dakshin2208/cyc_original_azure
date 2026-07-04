/**
 * @module lib/knowledge/warehouse/warehouse-builder
 *
 * Assembles the {@link CanonicalWarehouse} from parsed sources: transform →
 * build catalogs → build crosswalk → link facts to colleges → index → report.
 * Pure `buildWarehouse` (no I/O, fully testable) and a thin
 * `buildWarehouseFromDirectory` that adds the filesystem load.
 */

import { join } from 'path'
import { loadCsvDirectory, loadCsvFile, type CsvRow } from '../csv'
import { parseNirf2026, mergeNirf2026 } from '../nirf2026'
import type { CanonicalBranchId, CanonicalCollegeId, CommunityCode, NirfId } from '../ids'
import { buildCrosswalk } from '../mapping'
import type {
  CanonicalBranch,
  CanonicalCollege,
  CanonicalCommunity,
  CanonicalInstitution,
} from '../models'
import { comparisonKey } from '../normalization'
import {
  buildBranchCatalog,
  buildCommunityCatalog,
  transformColleges,
  transformFaculty,
  transformFinance,
  transformInstitutions,
  transformPlacements,
  transformResearch,
} from '../transform'
import type { ValidationIssue } from '../validation'
import type {
  CanonicalWarehouse,
  CrosswalkCoverage,
  RawSources,
  WarehouseStatistics,
} from './warehouse'

/** A linkable fact: carries its source NIRF id and a resolvable college id. */
interface Linkable {
  readonly nirfId: NirfId
  readonly collegeId: CanonicalCollegeId | null
}

/** Group linked facts by their resolved college id (skipping unlinked). */
function groupByCollege<T extends Linkable>(
  items: readonly T[],
): ReadonlyMap<CanonicalCollegeId, readonly T[]> {
  const map = new Map<CanonicalCollegeId, T[]>()
  for (const item of items) {
    if (item.collegeId === null) continue
    const arr = map.get(item.collegeId)
    if (arr) arr.push(item)
    else map.set(item.collegeId, [item])
  }
  return map
}

/** The canonical CSV file names used by {@link buildWarehouseFromDirectory}. */
export const SOURCE_FILES = {
  master: 'tn_nirf_299_colleges.csv',
  institutions: 'institutions.csv',
  cutoffs: 'Ftnea_cutoffs.csv',
  placement: 'placement_higher_studies.csv',
  faculty: 'faculty.csv',
  sponsored: 'sponsored_research.csv',
  consultancy: 'consultancy.csv',
  ipr: 'ipr.csv',
  phd: 'phd_graduated.csv',
  financialOperational: 'financial_operational.csv',
  financialCapital: 'financial_capital.csv',
} as const

/**
 * The 2026 canonical enrichment dataset. Loaded OPTIONALLY by
 * {@link buildWarehouseFromDirectory} (via try/catch) so directories that do not
 * ship it still build. Merged onto the college catalog, never overwriting sources.
 */
export const NIRF_2026_FILE = '2026_final_NIRF_data.csv'

/**
 * Build the canonical warehouse from parsed source rows. Deterministic and I/O-free.
 */
export function buildWarehouse(sources: RawSources): CanonicalWarehouse {
  const issues: ValidationIssue[] = []

  // 1. Transform.
  const collegesOut = transformColleges(sources.master, sources.institutions)
  const institutionsOut = transformInstitutions(sources.institutions)
  const placementsOut = transformPlacements(sources.placement)
  const facultyOut = transformFaculty(sources.faculty)
  const researchOut = transformResearch(
    sources.sponsoredResearch,
    sources.consultancy,
    sources.ipr,
    sources.phdGraduated,
  )
  const financeOut = transformFinance(sources.financialOperational, sources.financialCapital)
  issues.push(
    ...collegesOut.issues,
    ...institutionsOut.issues,
    ...placementsOut.issues,
    ...facultyOut.issues,
    ...researchOut.issues,
    ...financeOut.issues,
  )

  const colleges: readonly CanonicalCollege[] = collegesOut.items
  const institutions: readonly CanonicalInstitution[] = institutionsOut.items

  // 2026 enrichment: parse + merge onto the college catalog. Additive — the merge
  // never mutates a college and yields a full audit. Empty when the file is absent.
  const parsed2026 = parseNirf2026(sources.nirf2026 ?? [])
  const nirf2026 = mergeNirf2026(parsed2026.profiles, colleges, parsed2026.skipped)
  const branches: readonly CanonicalBranch[] = buildBranchCatalog(sources.tneaBranches)
  const communities: readonly CanonicalCommunity[] = buildCommunityCatalog()

  // 2. Crosswalk + 3. Link facts to colleges.
  const crosswalk = buildCrosswalk(colleges)
  let orphanedFacts = 0
  function link<T extends Linkable>(facts: readonly T[]): readonly T[] {
    return facts.map((fact) => {
      const collegeId = crosswalk.collegeIdForNirf(fact.nirfId)
      if (collegeId === null) orphanedFacts++
      return { ...fact, collegeId } as T
    })
  }
  const placements = link(placementsOut.items)
  const faculty = link(facultyOut.items)
  const research = link(researchOut.items)
  const finance = link(financeOut.items)

  // 4. Indexes.
  const collegeById = new Map<CanonicalCollegeId, CanonicalCollege>(colleges.map((c) => [c.id, c]))
  const collegeByNirf = new Map<NirfId, CanonicalCollege>()
  const nirfCollegeCounts = new Map<NirfId, number>()
  for (const c of colleges) {
    if (!c.nirfId) continue
    if (!collegeByNirf.has(c.nirfId)) collegeByNirf.set(c.nirfId, c) // first wins
    nirfCollegeCounts.set(c.nirfId, (nirfCollegeCounts.get(c.nirfId) ?? 0) + 1)
  }
  const nirfConflicts = [...nirfCollegeCounts.values()].filter((n) => n > 1).length
  const institutionByNirf = new Map<NirfId, CanonicalInstitution>(
    institutions.map((i) => [i.nirfId, i]),
  )
  const branchById = new Map<CanonicalBranchId, CanonicalBranch>(branches.map((b) => [b.id, b]))
  const branchByAlias = new Map<string, CanonicalBranch>()
  for (const b of branches) {
    branchByAlias.set(comparisonKey(b.canonicalName), b)
    for (const alias of b.aliases) branchByAlias.set(comparisonKey(alias), b)
  }
  const communityByCode = new Map<CommunityCode, CanonicalCommunity>(
    communities.map((c) => [c.code, c]),
  )

  // 5. Statistics, coverage + report.
  const rowsSkipped = issues.filter((i) => i.kind === 'missing_field').length
  const duplicatesRemoved = issues.filter((i) => i.kind === 'duplicate').length

  const statistics: WarehouseStatistics = {
    colleges: colleges.length,
    institutions: institutions.length,
    branches: branches.length,
    communities: communities.length,
    placements: placements.length,
    faculty: faculty.length,
    research: research.length,
    finance: finance.length,
    nirfLinkedColleges: crosswalk.nirfLinkedCount,
    nirfConflicts,
    orphanedFacts,
    duplicatesRemoved,
    rowsSkipped,
    issues: issues.length,
  }

  const distinctCounselling = new Set(
    sources.tneaCounsellingCodes.map((c) => c.trim()).filter((c) => c !== ''),
  ).size
  const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
  const nirfInstitutionsLinked = institutions.filter((i) => collegeByNirf.has(i.nirfId)).length
  const collegesWithNirf = colleges.filter((c) => c.nirfId !== null).length
  const collegesWithCounselling = colleges.filter((c) => c.counsellingCodes.length > 0).length
  const fullyBridged = colleges.filter(
    (c) => c.nirfId !== null && c.counsellingCodes.length > 0,
  ).length
  const coverage: CrosswalkCoverage = {
    nirfInstitutions: institutionByNirf.size,
    tneaCounsellingCodes: distinctCounselling,
    nirfInstitutionsLinked,
    collegesWithNirf,
    collegesWithCounselling,
    fullyBridged,
    nirfLinkagePct: pct(nirfInstitutionsLinked, institutionByNirf.size),
    bridgeCoveragePct: pct(fullyBridged, distinctCounselling),
  }

  return {
    colleges,
    institutions,
    branches,
    communities,
    placements,
    faculty,
    research,
    finance,
    crosswalk,
    collegeById,
    collegeByNirf,
    institutionByNirf,
    branchById,
    branchByAlias,
    communityByCode,
    placementsByCollege: groupByCollege(placements),
    facultyByCollege: groupByCollege(faculty),
    researchByCollege: groupByCollege(research),
    financeByCollege: groupByCollege(finance),
    nirf2026,
    report: { statistics, coverage, issues },
  }
}

/**
 * Build the warehouse by loading the canonical CSV files from a directory.
 * @param directory Directory containing the 21 source CSVs.
 */
export function buildWarehouseFromDirectory(directory: string): CanonicalWarehouse {
  const tables = loadCsvDirectory(directory, Object.values(SOURCE_FILES))
  const rows = (name: string) => tables.get(name)?.rows ?? []
  const cutoffRows = rows(SOURCE_FILES.cutoffs)
  const branchNames = [
    ...new Set(cutoffRows.map((r) => r.branch).filter((b) => b && b.trim() !== '')),
  ]
  const counsellingCodes = [
    ...new Set(cutoffRows.map((r) => r.counselling_code).filter((c) => c && c.trim() !== '')),
  ]
  // Optional 2026 enrichment: present in current data dirs, absent in older ones.
  let nirf2026Rows: readonly CsvRow[] = []
  try {
    nirf2026Rows = loadCsvFile(join(directory, NIRF_2026_FILE)).rows
  } catch {
    /* file not present — the 2026 enrichment is optional */
  }
  return buildWarehouse({
    master: rows(SOURCE_FILES.master),
    institutions: rows(SOURCE_FILES.institutions),
    tneaBranches: branchNames,
    tneaCounsellingCodes: counsellingCodes,
    placement: rows(SOURCE_FILES.placement),
    faculty: rows(SOURCE_FILES.faculty),
    sponsoredResearch: rows(SOURCE_FILES.sponsored),
    consultancy: rows(SOURCE_FILES.consultancy),
    ipr: rows(SOURCE_FILES.ipr),
    phdGraduated: rows(SOURCE_FILES.phd),
    financialOperational: rows(SOURCE_FILES.financialOperational),
    financialCapital: rows(SOURCE_FILES.financialCapital),
    nirf2026: nirf2026Rows,
  })
}
