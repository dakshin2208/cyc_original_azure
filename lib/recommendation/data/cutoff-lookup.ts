/**
 * @module lib/recommendation/data/cutoff-lookup
 *
 * Injectable historical-cutoff source for the Eligibility Engine. The Phase 1
 * warehouse currently exposes NO per-college branch/community closing cutoffs
 * (see the Knowledge Audit — the TNEA↔NIRF bridge and cutoff dataset are pending),
 * so the DEFAULT implementation returns `null` for every query and the engine
 * degrades gracefully to `unknown`. A real cutoff dataset can be injected later
 * without touching any engine code.
 */

import type { CanonicalCollege, CommunityCode } from '@/lib/knowledge'

/** A single closing-cutoff query. */
export interface CutoffQuery {
  readonly college: CanonicalCollege
  readonly community: CommunityCode
  /** Branch context (canonical or raw name), when supplied. */
  readonly branch?: string
}

/** A source of historical closing cutoffs. */
export interface CutoffLookup {
  /** Historical closing cutoff for the query, or `null` when unknown. */
  getClosingCutoff(query: CutoffQuery): number | null
}

/** The default lookup — no cutoff data available; every query is `null`. */
export const nullCutoffLookup: CutoffLookup = Object.freeze({
  getClosingCutoff: (): number | null => null,
})

/**
 * Build a cutoff lookup backed by an in-memory table. Keys are built from the
 * college id, community, and (optional) normalized branch. Useful for tests and
 * for wiring a future cutoff dataset without changing the engine.
 */
export function createTableCutoffLookup(
  rows: readonly { collegeId: string; community: string; branch?: string; closingCutoff: number }[],
): CutoffLookup {
  const key = (collegeId: string, community: string, branch?: string): string =>
    `${collegeId}::${community.toUpperCase()}::${(branch ?? '').trim().toLowerCase()}`
  const table = new Map<string, number>()
  for (const r of rows) table.set(key(r.collegeId, r.community, r.branch), r.closingCutoff)
  return Object.freeze({
    getClosingCutoff: (q: CutoffQuery): number | null => {
      const withBranch = table.get(key(q.college.id, q.community, q.branch))
      if (withBranch !== undefined) return withBranch
      // Fall back to a branch-agnostic entry.
      const branchless = table.get(key(q.college.id, q.community))
      return branchless ?? null
    },
  })
}
