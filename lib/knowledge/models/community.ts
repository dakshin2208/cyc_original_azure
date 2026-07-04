/**
 * @module lib/knowledge/models/community
 *
 * The Canonical Community — a TNEA reservation community. This is a fixed catalog
 * (not sourced from a CSV). Immutable.
 */

import type { CommunityCode } from '../ids'

/** A TNEA reservation community. */
export interface CanonicalCommunity {
  /** Canonical community code (e.g. `OC`, `BC`). */
  readonly code: CommunityCode
  /** Human-readable community name. */
  readonly name: string
}
