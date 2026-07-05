/**
 * @module lib/knowledge/models/faculty
 *
 * The Canonical Faculty — a single faculty member (source: `faculty.csv`), keyed
 * by NIRF institution + serial number, linked to a {@link CanonicalCollege} where
 * resolvable. Immutable.
 */

import type { CanonicalCollegeId, FacultyId, NirfId } from '../ids'

/** A faculty-member record. */
export interface CanonicalFaculty {
  /** Canonical faculty id. */
  readonly id: FacultyId
  /** Resolved canonical college, or `null` if unlinked. */
  readonly collegeId: CanonicalCollegeId | null
  /** Source NIRF institution. */
  readonly nirfId: NirfId
  /** Faculty name. */
  readonly name: string
  /** Designation (e.g. `Professor`), when known. */
  readonly designation: string | null
  /** Gender, when known. */
  readonly gender: string | null
  /** Highest qualification, when known. */
  readonly qualification: string | null
  /** Experience in months, when known. */
  readonly experienceMonths: number | null
  /** Whether currently working, when known. */
  readonly currentlyWorking: boolean | null
}
