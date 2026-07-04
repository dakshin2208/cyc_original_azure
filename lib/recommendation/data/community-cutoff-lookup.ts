/**
 * @module lib/recommendation/data/community-cutoff-lookup
 *
 * A {@link CutoffLookup} that judges a student against their OWN community's
 * college-level median closing cutoff (from the TNEA cutoff dataset), falling back to
 * the OC (general) cutoff when a community-specific mark is unavailable, and to `null`
 * (unknown) when neither is on file. This replaces the OC-for-everyone approximation:
 * a BC/MBC/SC student is now banded on the marks that actually apply to them.
 */

import type { KnowledgeRepositories } from '@/lib/knowledge'
import type { CutoffLookup } from './cutoff-lookup'

/** Build a community-aware cutoff lookup over the knowledge repositories. */
export function createCommunityCutoffLookup(repos: KnowledgeRepositories): CutoffLookup {
  return Object.freeze({
    getClosingCutoff: (query) =>
      repos.colleges.communityCutoffOf(query.college.id, query.community) ??
      repos.colleges.ocCutoffOf(query.college.id),
  })
}
