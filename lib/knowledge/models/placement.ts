/**
 * @module lib/knowledge/models/placement
 *
 * The Canonical Placement — a placement/outcome record (source:
 * `placement_higher_studies.csv`), keyed by NIRF institution and cohort, linked
 * to a {@link CanonicalCollege} where resolvable. Immutable.
 */

import type { CanonicalCollegeId, NirfId, PlacementId } from '../ids'

/** A placement / higher-studies outcome record for one cohort. */
export interface CanonicalPlacement {
  /** Canonical placement id. */
  readonly id: PlacementId
  /** Resolved canonical college, or `null` if unlinked. */
  readonly collegeId: CanonicalCollegeId | null
  /** Source NIRF institution. */
  readonly nirfId: NirfId
  /** Program level (e.g. `UG`, `PG`). */
  readonly programLevel: string
  /** Graduating cohort year (e.g. `2021-22`). */
  readonly graduatingYear: string
  /** First-year sanctioned intake, when known. */
  readonly firstYearIntake: number | null
  /** Students placed, when known. */
  readonly studentsPlaced: number | null
  /** Median salary (INR/year), when known. */
  readonly medianSalary: number | null
  /** Students who went for higher studies, when known. */
  readonly studentsHigherStudies: number | null
}
