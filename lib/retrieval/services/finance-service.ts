/**
 * @module lib/retrieval/services/finance-service
 *
 * Finance Retrieval Service (Sprint 2 §5). Computes operating/capital expenditure
 * and library/lab spend from the canonical finance records for a college.
 */

import type {
  CanonicalCollegeId,
  CanonicalFinance,
  KnowledgeRepositories,
  NirfId,
} from '@/lib/knowledge'
import type { FinanceSummary, FinanceYear } from '../models'
import { sumNonNull } from './aggregation'

/** Deterministic finance retrieval. */
export interface FinanceRetrievalService {
  getSummary(collegeId: CanonicalCollegeId): FinanceSummary | null
  getSummaryByNirf(nirf: NirfId): FinanceSummary | null
  getOperatingExpenditure(collegeId: CanonicalCollegeId): number | null
  getCapitalExpenditure(collegeId: CanonicalCollegeId): number | null
  getLibrary(collegeId: CanonicalCollegeId): number | null
  getLabs(collegeId: CanonicalCollegeId): number | null
}

const operating = (r: CanonicalFinance): number | null =>
  sumNonNull([r.salaries, r.maintenance, r.seminars])
const capital = (r: CanonicalFinance): number | null =>
  sumNonNull([r.library, r.labEquipment, r.otherCapital])

function summarize(
  collegeId: CanonicalCollegeId,
  records: readonly CanonicalFinance[],
): FinanceSummary {
  const sorted = [...records].sort((a, b) => a.year.localeCompare(b.year))
  const latest = sorted[sorted.length - 1]
  const byYear: FinanceYear[] = sorted.map((r) => ({
    year: r.year,
    operatingExpenditure: operating(r),
    capitalExpenditure: capital(r),
  }))
  return {
    collegeId,
    nirfId: latest.nirfId,
    latestYear: latest.year,
    operatingExpenditure: operating(latest),
    capitalExpenditure: capital(latest),
    library: latest.library,
    labs: latest.labEquipment,
    byYear,
  }
}

/** Create the finance retrieval service over the Phase 1 repositories. */
export function createFinanceService(repos: KnowledgeRepositories): FinanceRetrievalService {
  const summary = (collegeId: CanonicalCollegeId): FinanceSummary | null => {
    const records = repos.finance.byCollege(collegeId)
    return records.length > 0 ? summarize(collegeId, records) : null
  }
  return Object.freeze({
    getSummary: summary,
    getSummaryByNirf: (nirf) => {
      const college = repos.colleges.getByNirfId(nirf)
      return college ? summary(college.id) : null
    },
    getOperatingExpenditure: (id) => summary(id)?.operatingExpenditure ?? null,
    getCapitalExpenditure: (id) => summary(id)?.capitalExpenditure ?? null,
    getLibrary: (id) => summary(id)?.library ?? null,
    getLabs: (id) => summary(id)?.labs ?? null,
  })
}
