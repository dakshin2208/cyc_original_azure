/**
 * @module lib/retrieval/services/placement-service
 *
 * Placement Retrieval Service (Sprint 2 §4). Computes placement summaries from
 * the canonical placement records for a college. The sources report MEDIAN
 * salary only (no per-student maximum), so "highest package" is the highest
 * median observed across cohorts.
 */

import type {
  CanonicalCollegeId,
  CanonicalPlacement,
  KnowledgeRepositories,
  NirfId,
} from '@/lib/knowledge'
import type { PlacementSummary, TrendPoint } from '../models'
import { maxNonNull, roundTo } from './aggregation'

/** Deterministic placement retrieval. */
export interface PlacementRetrievalService {
  getSummary(collegeId: CanonicalCollegeId): PlacementSummary | null
  getSummaryByNirf(nirf: NirfId): PlacementSummary | null
  getMedianPackage(collegeId: CanonicalCollegeId): number | null
  getHighestPackage(collegeId: CanonicalCollegeId): number | null
  getPlacementPercentage(collegeId: CanonicalCollegeId): number | null
  getHigherStudies(collegeId: CanonicalCollegeId): number | null
  getTrend(collegeId: CanonicalCollegeId): readonly TrendPoint[]
}

function summarize(
  collegeId: CanonicalCollegeId,
  records: readonly CanonicalPlacement[],
): PlacementSummary {
  const sorted = [...records].sort((a, b) => a.graduatingYear.localeCompare(b.graduatingYear))
  const latest = sorted[sorted.length - 1]

  const byYear = new Map<string, number>()
  for (const r of records) {
    if (r.medianSalary === null) continue
    byYear.set(r.graduatingYear, Math.max(byYear.get(r.graduatingYear) ?? 0, r.medianSalary))
  }
  const salaryTrend: TrendPoint[] = [...byYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year.localeCompare(b.year))

  const placementPercentage =
    latest.studentsPlaced !== null && latest.firstYearIntake
      ? roundTo((latest.studentsPlaced / latest.firstYearIntake) * 100, 1)
      : null

  return {
    collegeId,
    nirfId: latest.nirfId,
    latestYear: latest.graduatingYear,
    medianSalary: latest.medianSalary,
    highestMedianSalary: maxNonNull(records.map((r) => r.medianSalary)),
    placementPercentage,
    higherStudies: latest.studentsHigherStudies,
    salaryTrend,
    cohorts: new Set(records.map((r) => r.graduatingYear)).size,
  }
}

/** Create the placement retrieval service over the Phase 1 repositories. */
export function createPlacementService(repos: KnowledgeRepositories): PlacementRetrievalService {
  const summary = (collegeId: CanonicalCollegeId): PlacementSummary | null => {
    const records = repos.placements.byCollege(collegeId)
    return records.length > 0 ? summarize(collegeId, records) : null
  }
  return Object.freeze({
    getSummary: summary,
    getSummaryByNirf: (nirf) => {
      const college = repos.colleges.getByNirfId(nirf)
      return college ? summary(college.id) : null
    },
    getMedianPackage: (id) => summary(id)?.medianSalary ?? null,
    getHighestPackage: (id) => summary(id)?.highestMedianSalary ?? null,
    getPlacementPercentage: (id) => summary(id)?.placementPercentage ?? null,
    getHigherStudies: (id) => summary(id)?.higherStudies ?? null,
    getTrend: (id) => summary(id)?.salaryTrend ?? [],
  })
}
