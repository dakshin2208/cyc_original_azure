/**
 * @module lib/knowledge/mapping/crosswalk
 *
 * The identity crosswalk — the spine that lets NIRF fact records resolve to a
 * canonical college. It indexes colleges by `nirfId` and by name slug.
 *
 * NOTE (per the audit): the source files contain no `counselling_code -> nirf_id`
 * mapping, so the TNEA admission side cannot be auto-linked here. The crosswalk
 * builds the NIRF side today and exposes the resolution surface the future
 * counselling-code dataset will populate.
 */

import type { CanonicalCollegeId, NirfId } from '../ids'
import type { CanonicalCollege } from '../models'

/** Resolves identifiers to canonical colleges. */
export interface Crosswalk {
  /** Resolve a college by its NIRF id. */
  resolveByNirf(nirf: NirfId): CanonicalCollege | null
  /** Resolve a college by its name slug. */
  resolveByNameSlug(slug: string): CanonicalCollege | null
  /** The canonical college id for a NIRF id, or `null` if unmapped. */
  collegeIdForNirf(nirf: NirfId): CanonicalCollegeId | null
  /** Count of colleges that carry a NIRF linkage. */
  readonly nirfLinkedCount: number
}

/** Build a {@link Crosswalk} from the canonical colleges. */
export function buildCrosswalk(colleges: readonly CanonicalCollege[]): Crosswalk {
  const byNirf = new Map<string, CanonicalCollege>()
  const bySlug = new Map<string, CanonicalCollege>()

  for (const college of colleges) {
    // First college wins for a shared nirf_id (deterministic fact linking).
    if (college.nirfId && !byNirf.has(college.nirfId)) byNirf.set(college.nirfId, college)
    if (!bySlug.has(college.nameSlug)) bySlug.set(college.nameSlug, college)
  }

  return {
    resolveByNirf: (nirf) => byNirf.get(nirf) ?? null,
    resolveByNameSlug: (slug) => bySlug.get(slug) ?? null,
    collegeIdForNirf: (nirf) => byNirf.get(nirf)?.id ?? null,
    nirfLinkedCount: byNirf.size,
  }
}
