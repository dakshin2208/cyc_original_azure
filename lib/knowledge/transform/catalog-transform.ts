/**
 * @module lib/knowledge/transform/catalog-transform
 *
 * Builds the dimension catalogs: the canonical branch catalog (from the many raw
 * TNEA branch spellings) and the fixed community catalog.
 */

import { communityCode, generateBranchId } from '../ids'
import type { CanonicalBranch, CanonicalCommunity } from '../models'
import { CANONICAL_COMMUNITIES, normalizeBranch } from '../normalization'

/**
 * Build the canonical branch catalog from raw branch names, grouping every raw
 * spelling under its canonical name and retaining the distinct aliases.
 */
export function buildBranchCatalog(rawBranchNames: readonly string[]): readonly CanonicalBranch[] {
  const byCanonical = new Map<string, { canonicalName: string; aliases: Set<string> }>()

  for (const raw of rawBranchNames) {
    const trimmed = raw.trim()
    if (trimmed === '') continue
    const { canonicalName } = normalizeBranch(trimmed)
    const entry = byCanonical.get(canonicalName) ?? { canonicalName, aliases: new Set<string>() }
    entry.aliases.add(trimmed)
    byCanonical.set(canonicalName, entry)
  }

  return [...byCanonical.values()].map((e) => ({
    id: generateBranchId(e.canonicalName),
    canonicalName: e.canonicalName,
    aliases: [...e.aliases].sort(),
  }))
}

/** Build the fixed community catalog. */
export function buildCommunityCatalog(): readonly CanonicalCommunity[] {
  return CANONICAL_COMMUNITIES.map((c) => ({ code: communityCode(c.code), name: c.name }))
}
