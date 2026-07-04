/**
 * @module lib/retrieval/models/summaries
 *
 * Computed retrieval DTOs — aggregations over the canonical warehouse records
 * (placement/finance/research/faculty). These are new response shapes the
 * warehouse does not itself provide. Canonical entities are reused as payloads
 * (no duplicated models); only the derived summaries are defined here.
 */

import type {
  CanonicalCollege,
  CanonicalCollegeId,
  CanonicalInstitution,
  NirfId,
} from '@/lib/knowledge'

/** A single (year, value) point in a trend series. */
export interface TrendPoint {
  readonly year: string
  readonly value: number
}

/** Placement / outcome summary for a college. */
export interface PlacementSummary {
  readonly collegeId: CanonicalCollegeId
  readonly nirfId: NirfId | null
  /** Latest cohort year present. */
  readonly latestYear: string | null
  /** Median salary for the latest cohort (INR/year). */
  readonly medianSalary: number | null
  /** Highest median salary observed across cohorts (the sources report medians only). */
  readonly highestMedianSalary: number | null
  /** Placement percentage for the latest cohort (placed / first-year intake). */
  readonly placementPercentage: number | null
  /** Students who pursued higher studies (latest cohort). */
  readonly higherStudies: number | null
  /** Median-salary trend across cohorts. */
  readonly salaryTrend: readonly TrendPoint[]
  /** Number of cohorts available. */
  readonly cohorts: number
}

/** One year's finance figures. */
export interface FinanceYear {
  readonly year: string
  readonly operatingExpenditure: number | null
  readonly capitalExpenditure: number | null
}

/** Finance summary for a college. */
export interface FinanceSummary {
  readonly collegeId: CanonicalCollegeId
  readonly nirfId: NirfId | null
  readonly latestYear: string | null
  /** Salaries + maintenance + seminars (latest year). */
  readonly operatingExpenditure: number | null
  /** Library + lab equipment + other capital (latest year). */
  readonly capitalExpenditure: number | null
  /** Library capital spend (latest year). */
  readonly library: number | null
  /** Lab/equipment capital spend (latest year). */
  readonly labs: number | null
  readonly byYear: readonly FinanceYear[]
}

/** Research summary for a college (latest year). */
export interface ResearchSummary {
  readonly collegeId: CanonicalCollegeId
  readonly nirfId: NirfId | null
  readonly latestYear: string | null
  readonly sponsoredProjects: number | null
  readonly sponsoredAmount: number | null
  readonly consultancyProjects: number | null
  readonly consultancyAmount: number | null
  readonly patentsPublished: number | null
  readonly patentsGranted: number | null
  readonly phdGraduated: number | null
  readonly years: number
}

/** Faculty summary for a college. */
export interface FacultySummary {
  readonly collegeId: CanonicalCollegeId
  readonly nirfId: NirfId | null
  readonly total: number
  readonly currentlyWorking: number
  readonly female: number
  readonly withPhd: number
  readonly avgExperienceMonths: number | null
}

/** A full institution profile aggregating NIRF + finance + research + faculty. */
export interface InstitutionProfile {
  readonly institution: CanonicalInstitution
  readonly college: CanonicalCollege | null
  readonly finance: FinanceSummary | null
  readonly research: ResearchSummary | null
  readonly faculty: FacultySummary | null
}

/** A college paired with its placement summary (search-with-facts). */
export interface CollegePlacementView {
  readonly college: CanonicalCollege
  readonly placement: PlacementSummary | null
}

/** A college paired with its finance summary. */
export interface CollegeFinanceView {
  readonly college: CanonicalCollege
  readonly finance: FinanceSummary | null
}

/** A college paired with its research summary. */
export interface CollegeResearchView {
  readonly college: CanonicalCollege
  readonly research: ResearchSummary | null
}
