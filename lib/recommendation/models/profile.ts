/**
 * @module lib/recommendation/models/profile
 *
 * The per-college data bundle the scoring engine consumes. Aggregated from the
 * Sprint 2 retrieval engine (no warehouse internals). Reuses the retrieval
 * summary DTOs — no duplication.
 */

import type { CanonicalCollege, CanonicalInstitution } from '@/lib/knowledge'
import type { FacultySummary, FinanceSummary, PlacementSummary, ResearchSummary } from '@/lib/retrieval'
import type { InstituteType } from './enums'

/** Everything the scorer needs about one college. */
export interface CollegeProfile {
  readonly college: CanonicalCollege
  readonly institution: CanonicalInstitution | null
  readonly placement: PlacementSummary | null
  readonly finance: FinanceSummary | null
  readonly research: ResearchSummary | null
  readonly faculty: FacultySummary | null
  readonly instituteType: InstituteType
  /** District (from the 2026 dataset), or `null` when unknown. Used for filtering. */
  readonly district: string | null
  /** OC closing cutoff (from the 2026 dataset), or `null`. Selectivity / demand signal. */
  readonly ocCutoff: number | null
  /**
   * The CYC Power Score [0,100] — the branded 4-vector percentile composite from the 2026
   * dataset — or `null` when the college has none. NOT the engine's internal match score.
   */
  readonly powerScore: number | null
  /** 1-based Tamil Nadu rank BY CYC Power Score, or `null` when the college has no score. */
  readonly powerScoreRank: number | null
  /**
   * Canonical branch names this college offers (from the TNEA cutoff dataset), or an empty
   * set when unknown. Used to PREFER colleges that actually offer a requested branch.
   */
  readonly branchesOffered: ReadonlySet<string>
}
