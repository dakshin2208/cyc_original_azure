/**
 * @module lib/knowledge/models/branch
 *
 * The Canonical Branch — a single normalized course/branch, unifying the many
 * raw spellings (e.g. "AI&DS", "Artificial Intelligence and Data Science") under
 * one canonical name + id, with the observed aliases retained. Immutable.
 */

import type { CanonicalBranchId } from '../ids'

/** A canonical branch (course) with its known aliases. */
export interface CanonicalBranch {
  /** Canonical branch id. */
  readonly id: CanonicalBranchId
  /** Canonical, normalized branch name. */
  readonly canonicalName: string
  /** Distinct raw spellings observed in the sources that map to this branch. */
  readonly aliases: readonly string[]
}
