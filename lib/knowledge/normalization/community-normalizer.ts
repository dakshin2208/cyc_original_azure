/**
 * @module lib/knowledge/normalization/community-normalizer
 *
 * Reservation-community normalization. Maps raw community labels to canonical
 * TNEA community codes.
 */

import { communityCode, type CommunityCode } from '../ids'

/** Canonical TNEA communities with display names. */
export const CANONICAL_COMMUNITIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'OC', name: 'Open Category' },
  { code: 'BC', name: 'Backward Class' },
  { code: 'BCM', name: 'Backward Class Muslim' },
  { code: 'MBC', name: 'Most Backward Class' },
  { code: 'MBCDNC', name: 'Most Backward Class / Denotified Communities' },
  { code: 'MBCV', name: 'Most Backward Class (Vanniyakula Kshatriya)' },
  { code: 'SC', name: 'Scheduled Caste' },
  { code: 'SCA', name: 'Scheduled Caste (Arunthathiyar)' },
  { code: 'ST', name: 'Scheduled Tribe' },
]

/** Raw label -> canonical code aliases. */
const ALIASES: Readonly<Record<string, string>> = {
  OC: 'OC',
  GENERAL: 'OC',
  OPEN: 'OC',
  BC: 'BC',
  BCM: 'BCM',
  MBC: 'MBC',
  MBCDNC: 'MBCDNC',
  MBCV: 'MBCV',
  SC: 'SC',
  SCA: 'SCA',
  ST: 'ST',
}

/**
 * Normalize a raw community label to a canonical {@link CommunityCode}, or `null`
 * when unrecognized.
 * @param raw The raw community label.
 */
export function normalizeCommunity(raw: string): CommunityCode | null {
  const key = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  const code = ALIASES[key]
  return code ? communityCode(code) : null
}
