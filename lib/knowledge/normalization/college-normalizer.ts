/**
 * @module lib/knowledge/normalization/college-normalizer
 *
 * College-name normalization: strips embedded NIRF codes, collapses whitespace,
 * and derives a comparison slug used for dedupe and fuzzy matching.
 */

import { slugify } from '../ids'
import { collapseWhitespace, stripBracketedCodes } from './text'

/** The outcome of normalizing a raw college name. */
export interface CollegeNormalization {
  /** The cleaned display name. */
  readonly name: string
  /** The comparison slug (lowercase, punctuation-free). */
  readonly slug: string
}

/**
 * Normalize a raw college name.
 * @param raw The raw college name (may contain a trailing `[IR-...]` code).
 */
export function normalizeCollegeName(raw: string): CollegeNormalization {
  const name = collapseWhitespace(stripBracketedCodes(raw))
  return { name, slug: slugify(name) }
}
