/**
 * @module lib/knowledge/models/institution
 *
 * The Canonical Institution — the NIRF institution record (source:
 * `institutions.csv`), keyed by `nirfId`. Distinct from {@link CanonicalCollege}
 * (the unified entity); an institution is the NIRF-specific facet. Immutable.
 */

import type { NirfId } from '../ids'

/** A NIRF institution record. */
export interface CanonicalInstitution {
  /** NIRF identifier. */
  readonly nirfId: NirfId
  /** Institution name (normalized). */
  readonly name: string
  /** NIRF category (e.g. `ENGINEERING`), when known. */
  readonly category: string | null
  /** NIRF submission year, when known. */
  readonly submissionYear: number | null
  /** Pincode, when known. */
  readonly pincode: string | null
  /** Full-time PhD scholars currently pursuing, when known. */
  readonly phdFulltimePursuing: number | null
  /** Part-time PhD scholars currently pursuing, when known. */
  readonly phdParttimePursuing: number | null
}
