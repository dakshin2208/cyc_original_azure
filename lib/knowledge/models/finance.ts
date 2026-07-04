/**
 * @module lib/knowledge/models/finance
 *
 * The Canonical Finance — a per-institution, per-year consolidation of the two
 * finance sources (`financial_operational`, `financial_capital`) into one record,
 * linked to a {@link CanonicalCollege} where resolvable. Immutable.
 */

import type { CanonicalCollegeId, FinanceId, NirfId } from '../ids'

/** Consolidated finance data for one institution in one year (INR). */
export interface CanonicalFinance {
  /** Canonical finance id. */
  readonly id: FinanceId
  /** Resolved canonical college, or `null` if unlinked. */
  readonly collegeId: CanonicalCollegeId | null
  /** Source NIRF institution. */
  readonly nirfId: NirfId
  /** Academic year (e.g. `2023-24`). */
  readonly year: string
  /** Operational: salaries. */
  readonly salaries: number | null
  /** Operational: maintenance of infrastructure. */
  readonly maintenance: number | null
  /** Operational: seminars/workshops. */
  readonly seminars: number | null
  /** Capital: library. */
  readonly library: number | null
  /** Capital: lab equipment & software. */
  readonly labEquipment: number | null
  /** Capital: other capital assets. */
  readonly otherCapital: number | null
}
