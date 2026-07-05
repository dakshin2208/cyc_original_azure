/**
 * @module lib/knowledge/normalization/text
 * Generic text-normalization helpers used across the canonicalization layer.
 */

/** Collapse runs of whitespace to single spaces and trim. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Remove trailing bracketed NIRF codes like `[IR-E-C-16614]` from a name. */
export function stripBracketedCodes(text: string): string {
  return collapseWhitespace(text.replace(/\[[^\]]*\]/g, ' '))
}

/** Title-case a string word-by-word (simple, locale-agnostic). */
export function titleCase(text: string): string {
  return collapseWhitespace(text)
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Build a case/punctuation-insensitive comparison key from arbitrary text. */
export function comparisonKey(text: string): string {
  return text
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\([^)]*\)/g, ' ') // drop parentheticals like (SS)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
