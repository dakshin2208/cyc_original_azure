/**
 * @module lib/retrieval/services/research-service
 *
 * Research Retrieval Service (Sprint 2 §6). Surfaces sponsored projects,
 * consultancy, patents, and PhD output from the canonical research records.
 */

import type {
  CanonicalCollegeId,
  CanonicalResearch,
  KnowledgeRepositories,
  NirfId,
} from '@/lib/knowledge'
import type { ResearchSummary } from '../models'

/** Consultancy figures. */
export interface ConsultancyFigures {
  readonly projects: number | null
  readonly amount: number | null
}

/** Patent figures. */
export interface PatentFigures {
  readonly published: number | null
  readonly granted: number | null
}

/** Deterministic research retrieval. */
export interface ResearchRetrievalService {
  getSummary(collegeId: CanonicalCollegeId): ResearchSummary | null
  getSummaryByNirf(nirf: NirfId): ResearchSummary | null
  getSponsoredProjects(collegeId: CanonicalCollegeId): number | null
  getConsultancy(collegeId: CanonicalCollegeId): ConsultancyFigures | null
  getPatents(collegeId: CanonicalCollegeId): PatentFigures | null
  getPhdGraduates(collegeId: CanonicalCollegeId): number | null
}

function summarize(
  collegeId: CanonicalCollegeId,
  records: readonly CanonicalResearch[],
): ResearchSummary {
  const sorted = [...records].sort((a, b) => a.year.localeCompare(b.year))
  const latest = sorted[sorted.length - 1]
  return {
    collegeId,
    nirfId: latest.nirfId,
    latestYear: latest.year,
    sponsoredProjects: latest.sponsoredProjects,
    sponsoredAmount: latest.sponsoredAmount,
    consultancyProjects: latest.consultancyProjects,
    consultancyAmount: latest.consultancyAmount,
    patentsPublished: latest.patentsPublished,
    patentsGranted: latest.patentsGranted,
    phdGraduated: latest.phdGraduated,
    years: new Set(records.map((r) => r.year)).size,
  }
}

/** Create the research retrieval service over the Phase 1 repositories. */
export function createResearchService(repos: KnowledgeRepositories): ResearchRetrievalService {
  const summary = (collegeId: CanonicalCollegeId): ResearchSummary | null => {
    const records = repos.research.byCollege(collegeId)
    return records.length > 0 ? summarize(collegeId, records) : null
  }
  return Object.freeze({
    getSummary: summary,
    getSummaryByNirf: (nirf) => {
      const college = repos.colleges.getByNirfId(nirf)
      return college ? summary(college.id) : null
    },
    getSponsoredProjects: (id) => summary(id)?.sponsoredProjects ?? null,
    getConsultancy: (id) => {
      const s = summary(id)
      return s ? { projects: s.consultancyProjects, amount: s.consultancyAmount } : null
    },
    getPatents: (id) => {
      const s = summary(id)
      return s ? { published: s.patentsPublished, granted: s.patentsGranted } : null
    },
    getPhdGraduates: (id) => summary(id)?.phdGraduated ?? null,
  })
}
