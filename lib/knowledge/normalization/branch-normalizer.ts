/**
 * @module lib/knowledge/normalization/branch-normalizer
 *
 * Branch (course) normalization. Collapses the many raw spellings the sources
 * use into one canonical name via a curated alias table, falling back to a
 * cleaned title-cased form for unrecognized inputs.
 *
 * Examples:
 *   "AI&DS"                 -> "Artificial Intelligence and Data Science"
 *   "Agriculture Engineering" -> "Agricultural Engineering"
 */

import { comparisonKey, titleCase } from './text'

/** The outcome of normalizing a raw branch name. */
export interface BranchNormalization {
  /** The canonical branch name. */
  readonly canonicalName: string
  /** Whether the input matched a curated alias (vs. fell back to cleanup). */
  readonly matched: boolean
}

/** Curated canonical branches with their known raw aliases. */
const CANONICAL_BRANCHES: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [
  {
    canonical: 'Artificial Intelligence and Data Science',
    aliases: ['AI&DS', 'AI & DS', 'AIDS', 'AI DS', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE'],
  },
  {
    canonical: 'Artificial Intelligence and Machine Learning',
    aliases: ['AI&ML', 'AI & ML', 'AIML', 'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING'],
  },
  {
    canonical: 'Agricultural Engineering',
    aliases: ['AGRICULTURE ENGINEERING', 'AGRICULTURAL ENGINEERING', 'AGRI ENGINEERING'],
  },
  {
    canonical: 'Computer Science and Engineering',
    aliases: ['CSE', 'CS', 'COMPUTER SCIENCE AND ENGINEERING', 'COMPUTER SCIENCE ENGINEERING'],
  },
  {
    canonical: 'Electronics and Communication Engineering',
    aliases: ['ECE', 'ELECTRONICS AND COMMUNICATION ENGINEERING'],
  },
  {
    canonical: 'Electrical and Electronics Engineering',
    aliases: ['EEE', 'ELECTRICAL AND ELECTRONICS ENGINEERING'],
  },
  {
    canonical: 'Mechanical Engineering',
    aliases: ['MECH', 'MECHANICAL ENGINEERING'],
  },
  {
    canonical: 'Civil Engineering',
    aliases: ['CIVIL', 'CIVIL ENGINEERING'],
  },
  {
    canonical: 'Information Technology',
    aliases: ['IT', 'INFORMATION TECHNOLOGY'],
  },
]

/** Prebuilt lookup from comparison key -> canonical name. */
const ALIAS_LOOKUP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const entry of CANONICAL_BRANCHES) {
    map.set(comparisonKey(entry.canonical), entry.canonical)
    for (const alias of entry.aliases) map.set(comparisonKey(alias), entry.canonical)
  }
  return map
})()

/**
 * Normalize a raw branch name to its canonical form.
 * @param raw The raw branch text.
 */
export function normalizeBranch(raw: string): BranchNormalization {
  const key = comparisonKey(raw)
  const canonical = ALIAS_LOOKUP.get(key)
  if (canonical) return { canonicalName: canonical, matched: true }
  // Fallback: cleaned, title-cased form (parentheticals dropped by the key rules
  // are re-derived from the raw text minus bracketed self-support markers).
  const cleaned = raw.replace(/\([^)]*\)/g, ' ')
  return { canonicalName: titleCase(cleaned), matched: false }
}
