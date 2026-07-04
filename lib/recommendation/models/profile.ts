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
}
