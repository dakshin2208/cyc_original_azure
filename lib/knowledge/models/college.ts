/**
 * @module lib/knowledge/models/college
 *
 * The Canonical College — the identity spine of the warehouse. Unifies the TNEA
 * admission view (`counsellingCodes`) and the NIRF quality view (`nirfId`) under
 * one warehouse-assigned id. Either linkage may be absent (per the audit, the
 * two source systems are not fully bridged). Immutable.
 */

import type { CanonicalCollegeId, CounsellingCode, NirfId } from '../ids'

/** A unified, canonical college entity. */
export interface CanonicalCollege {
  /** Warehouse-assigned canonical id. */
  readonly id: CanonicalCollegeId
  /** Display name (normalized). */
  readonly name: string
  /** Normalized slug of the name (for fuzzy matching / dedupe). */
  readonly nameSlug: string
  /** City, when known. */
  readonly city: string | null
  /** State, when known. */
  readonly state: string | null
  /** NIRF linkage (quality data), or `null` if unlinked. */
  readonly nirfId: NirfId | null
  /** TNEA counselling codes (admission data) linked to this college. */
  readonly counsellingCodes: readonly CounsellingCode[]
  /** Whether NIRF quality data is available for this college. */
  readonly hasNirfData: boolean
}
