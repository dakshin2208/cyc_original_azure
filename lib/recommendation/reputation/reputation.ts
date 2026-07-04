/**
 * @module lib/recommendation/reputation/reputation
 *
 * Deterministic reputation tiers. A college's tier is derived from its OC closing
 * cutoff (a strong, evidence-based demand/reputation proxy), then floored by a curated
 * seed for marquee colleges whose data is too sparse to tier by cutoff alone (each seed
 * entry justified by external evidence; a floor only, never a demotion). The tier is
 * embedded as a disjoint band in the ranking total so a higher tier dominates marginal
 * score differences — "tiers dominate; scores refine." No college's final rank is
 * hard-coded; the transparent comparator still orders within a tier.
 */

import type { ReputationConfig } from '../config'
import type { CollegeProfile, ReputationTier } from '../models'

/** Rank of each tier (0 = most prestigious). */
export const TIER_ORDER: Readonly<Record<ReputationTier, number>> = {
  elite: 0,
  strong: 1,
  good: 2,
  emerging: 3,
  regional: 4,
}

function cutoffTier(cutoff: number | null, bands: ReputationConfig['cutoffBands']): ReputationTier {
  if (cutoff === null) return 'regional'
  if (cutoff >= bands.elite) return 'elite'
  if (cutoff >= bands.strong) return 'strong'
  if (cutoff >= bands.good) return 'good'
  if (cutoff >= bands.emerging) return 'emerging'
  return 'regional'
}

/** The reputation tier for a college: cutoff-derived, floored by the curated seed. */
export function reputationTier(profile: CollegeProfile, config: ReputationConfig): ReputationTier {
  let tier = cutoffTier(profile.ocCutoff, config.cutoffBands)
  const slug = profile.college.nameSlug
  for (const [seedSlug, seedTier] of config.seed) {
    if (slug.includes(seedSlug) && TIER_ORDER[seedTier] < TIER_ORDER[tier]) tier = seedTier
  }
  return tier
}

/**
 * The reputation-banded ranking total: a disjoint band per tier, refined within the
 * band by the raw score. Monotone in (tier, rawScore) so ranking stays a stable sort,
 * and the result is kept within [0, 1].
 */
export function tierBandedTotal(
  tier: ReputationTier,
  rawTotal: number,
  config: ReputationConfig,
): number {
  const clamped = rawTotal < 0 ? 0 : rawTotal > 1 ? 1 : rawTotal
  return config.bandBase[tier] + clamped * config.bandSpan
}
