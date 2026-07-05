/**
 * @module lib/retrieval/services/institution-service
 *
 * Institution Retrieval Service (Sprint 2 §3). Aggregates a full institution
 * profile (NIRF info + finance + research + faculty) by delegating to the finance
 * and research services and computing a faculty summary. No duplicate logic.
 */

import type {
  CanonicalCollege,
  CanonicalFaculty,
  CanonicalInstitution,
  KnowledgeRepositories,
  NirfId,
} from '@/lib/knowledge'
import type { FacultySummary, FinanceSummary, InstitutionProfile, ResearchSummary } from '../models'
import { avgNonNull } from './aggregation'
import type { FinanceRetrievalService } from './finance-service'
import type { ResearchRetrievalService } from './research-service'

/** Deterministic institution retrieval. */
export interface InstitutionRetrievalService {
  /** Full institution profile, or `null` when the NIRF id is unknown. */
  getProfile(nirf: NirfId): InstitutionProfile | null
  /** NIRF institution record, or `null`. */
  getNirfInfo(nirf: NirfId): CanonicalInstitution | null
  /** Finance summary for the institution, or `null`. */
  getFinance(nirf: NirfId): FinanceSummary | null
  /** Faculty summary for the institution, or `null`. */
  getFaculty(nirf: NirfId): FacultySummary | null
  /** Research summary for the institution, or `null`. */
  getResearch(nirf: NirfId): ResearchSummary | null
}

const isPhd = (qualification: string | null): boolean =>
  qualification !== null && /ph\.?\s*d/i.test(qualification)

function facultySummary(
  college: CanonicalCollege,
  nirf: NirfId,
  faculty: readonly CanonicalFaculty[],
): FacultySummary {
  return {
    collegeId: college.id,
    nirfId: nirf,
    total: faculty.length,
    currentlyWorking: faculty.filter((f) => f.currentlyWorking === true).length,
    female: faculty.filter((f) => (f.gender ?? '').toLowerCase() === 'female').length,
    withPhd: faculty.filter((f) => isPhd(f.qualification)).length,
    avgExperienceMonths: avgNonNull(faculty.map((f) => f.experienceMonths)),
  }
}

/** Create the institution retrieval service over the Phase 1 repositories. */
export function createInstitutionService(
  repos: KnowledgeRepositories,
  finance: FinanceRetrievalService,
  research: ResearchRetrievalService,
): InstitutionRetrievalService {
  const faculty = (nirf: NirfId): FacultySummary | null => {
    const college = repos.colleges.getByNirfId(nirf)
    if (!college) return null
    return facultySummary(college, nirf, repos.faculty.byCollege(college.id))
  }

  return Object.freeze({
    getNirfInfo: (nirf) => repos.institutions.getByNirfId(nirf),
    getFinance: (nirf) => finance.getSummaryByNirf(nirf),
    getResearch: (nirf) => research.getSummaryByNirf(nirf),
    getFaculty: faculty,
    getProfile: (nirf) => {
      const institution = repos.institutions.getByNirfId(nirf)
      if (!institution) return null
      return {
        institution,
        college: repos.colleges.getByNirfId(nirf),
        finance: finance.getSummaryByNirf(nirf),
        research: research.getSummaryByNirf(nirf),
        faculty: faculty(nirf),
      }
    },
  })
}
