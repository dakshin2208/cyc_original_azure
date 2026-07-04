/**
 * @module lib/knowledge/models/research
 *
 * The Canonical Research — a per-institution, per-year consolidation of the four
 * research sources (`sponsored_research`, `consultancy`, `ipr`, `phd_graduated`)
 * into one record, linked to a {@link CanonicalCollege} where resolvable.
 * Immutable.
 */

import type { CanonicalCollegeId, NirfId, ResearchId } from '../ids'

/** Consolidated research activity for one institution in one year. */
export interface CanonicalResearch {
  /** Canonical research id. */
  readonly id: ResearchId
  /** Resolved canonical college, or `null` if unlinked. */
  readonly collegeId: CanonicalCollegeId | null
  /** Source NIRF institution. */
  readonly nirfId: NirfId
  /** Reference year (financial/calendar/academic, as reported). */
  readonly year: string
  /** Sponsored research projects, when known. */
  readonly sponsoredProjects: number | null
  /** Sponsored research amount received (INR), when known. */
  readonly sponsoredAmount: number | null
  /** Consultancy projects, when known. */
  readonly consultancyProjects: number | null
  /** Consultancy amount received (INR), when known. */
  readonly consultancyAmount: number | null
  /** Patents published, when known. */
  readonly patentsPublished: number | null
  /** Patents granted, when known. */
  readonly patentsGranted: number | null
  /** PhDs graduated (full + part time), when known. */
  readonly phdGraduated: number | null
}
