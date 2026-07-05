/**
 * @module lib/knowledge/transform/values
 *
 * Value coercion helpers. The sources store numbers as text (often with thousands
 * separators, e.g. `"1,248"`), booleans as `Yes`/`True`, and years in mixed
 * formats. These helpers produce clean, typed values or `null`.
 */

/** Parse an integer (stripping commas), or `null` when blank/invalid. */
export function parseIntOrNull(value: string | undefined): number | null {
  if (value === undefined) return null
  const s = value.replace(/,/g, '').trim()
  if (s === '') return null
  const n = Number.parseInt(s, 10)
  return Number.isNaN(n) ? null : n
}

/** Parse a float (stripping commas), or `null` when blank/invalid. */
export function parseFloatOrNull(value: string | undefined): number | null {
  if (value === undefined) return null
  const s = value.replace(/,/g, '').trim()
  if (s === '') return null
  const n = Number.parseFloat(s)
  return Number.isNaN(n) ? null : n
}

/** Parse a boolean (`Yes`/`True`/`1` -> true; `No`/`False`/`0` -> false), else `null`. */
export function parseBoolOrNull(value: string | undefined): boolean | null {
  if (value === undefined) return null
  const s = value.trim().toLowerCase()
  if (s === '') return null
  if (['yes', 'true', '1', 'y'].includes(s)) return true
  if (['no', 'false', '0', 'n'].includes(s)) return false
  return null
}

/** Trim to a non-empty string, or `null`. */
export function textOrNull(value: string | undefined): string | null {
  if (value === undefined) return null
  const s = value.trim()
  return s === '' ? null : s
}

/**
 * Normalize a mixed-format year to a 4-digit start year string
 * (`"2023-24"` -> `"2023"`, `"2023"` -> `"2023"`), or `null`. Used to align the
 * research/finance sources, which report years in different formats.
 */
export function normalizeYear(value: string | undefined): string | null {
  if (value === undefined) return null
  const m = value.match(/(\d{4})/)
  return m ? m[1] : null
}
