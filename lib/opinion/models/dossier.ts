/**
 * @module lib/opinion/models/dossier
 *
 * A structured, per-college evidence dossier assembled from the retrieval +
 * recommendation output. Fees and scholarships are explicitly `null` because the
 * warehouse does not carry them (Knowledge Audit) — the engine reports them as
 * unavailable rather than inventing them.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { FacultySummary, FinanceSummary, PlacementSummary, ResearchSummary, TrendPoint } from '@/lib/retrieval'
import type { EligibilityAssessment, InstituteType, ScoreDimension } from '@/lib/recommendation'
import type { ConfidenceLevel } from '@/lib/ai/orchestration'

/** A single college's evidence dossier. */
export interface CollegeDossier {
  readonly college: CanonicalCollege
  readonly instituteType: InstituteType
  readonly placement: PlacementSummary | null
  readonly faculty: FacultySummary | null
  readonly research: ResearchSummary | null
  readonly finance: FinanceSummary | null
  /** Not in the dataset — always `null` (reported as unavailable). */
  readonly fees: null
  /** Not in the dataset — always `null` (reported as unavailable). */
  readonly scholarships: null
  readonly location: string | null
  /** Top scoring dimensions (its strengths). */
  readonly strengths: readonly ScoreDimension[]
  /** Weakest data-backed dimensions. */
  readonly weaknesses: readonly ScoreDimension[]
  /** Historical median-salary trend (empty when unavailable). */
  readonly trend: readonly TrendPoint[]
  /** Eligibility band for the student, when a cutoff dataset is wired. */
  readonly eligibility: EligibilityAssessment | null
  /**
   * The recommendation engine's INTERNAL match score in [0, 1] (how well this college fits
   * the query). NOT the CYC Power Score — never present it under that label.
   */
  readonly overallScore: number
  /**
   * The CYC Power Score [0,100] — the branded 4-vector percentile composite from the
   * warehouse — or `null` when the college has none on file (then it is not displayed).
   */
  readonly powerScore: number | null
  /** 1-based Tamil Nadu rank BY CYC Power Score — consistent with {@link powerScore}. */
  readonly powerScoreRank: number | null
  readonly confidence: ConfidenceLevel
  /** Ids of the evidence items that back this dossier. */
  readonly evidenceIds: readonly string[]
}
