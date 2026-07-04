/**
 * @module lib/recommendation/data/nirf2026-cutoff-lookup
 *
 * A {@link CutoffLookup} backed by the 2026 dataset's OC closing cutoff (`ocCutoff`).
 *
 * NOTE: `ocCutoff` is the OC (general-category) closing cutoff — the HIGHEST band.
 * It is used as a CONSERVATIVE eligibility threshold for every community: a reserved
 * student who clears the OC cutoff is definitely admissible, so a college is only
 * excluded when the student is well below even the OC cutoff. Community- and
 * branch-specific closing cutoffs are a future refinement (not yet in the warehouse),
 * so `community`/`branch` are accepted but not differentiated here. No guessing —
 * a college with no OC cutoff returns `null` (unknown), never a fabricated value.
 */

import type { CanonicalCollegeId } from '@/lib/knowledge'
import type { CutoffLookup } from './cutoff-lookup'

/** Build a cutoff lookup from a `collegeId -> OC closing cutoff` map. */
export function createNirf2026CutoffLookup(
  ocCutoffByCollege: ReadonlyMap<CanonicalCollegeId, number | null>,
): CutoffLookup {
  return Object.freeze({
    getClosingCutoff: (query) => ocCutoffByCollege.get(query.college.id) ?? null,
  })
}
