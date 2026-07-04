/**
 * @module lib/knowledge/ids/canonical-id
 *
 * Deterministic canonical-id generation. Ids are derived purely from natural
 * keys (no randomness), so re-running the warehouse build yields identical ids —
 * essential for stable joins and idempotent ingestion.
 */

import type {
  CanonicalBranchId,
  CanonicalCollegeId,
  FacultyId,
  FinanceId,
  NirfId,
  PlacementId,
  ResearchId,
} from './identifiers'

/**
 * Convert arbitrary text to a URL-safe, diacritic-free slug.
 * `"Artificial Intelligence & Data Science (SS)"` -> `"artificial-intelligence-and-data-science-ss"`.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/** Join id parts with a stable separator, slugging each part. */
function joinId(parts: readonly string[]): string {
  return parts
    .map((p) => slugify(String(p)))
    .filter((p) => p.length > 0)
    .join(':')
}

/**
 * Generate a canonical college id from the college NAME.
 *
 * NOTE: the id is deliberately name-based, NOT nirf-based. The source master
 * assigns the same `nirf_id` to multiple distinct colleges (affiliated colleges
 * sharing a NIRF-reporting parent / data errors), so a nirf-based id would
 * silently merge different colleges. The `nirf_id` is therefore a shared linkage
 * attribute on the college, never its identity.
 */
export function generateCollegeId(input: { readonly name: string }): CanonicalCollegeId {
  return `col:${slugify(input.name)}` as CanonicalCollegeId
}

/** Generate a canonical branch id from its canonical name. */
export function generateBranchId(canonicalName: string): CanonicalBranchId {
  return `br:${slugify(canonicalName)}` as CanonicalBranchId
}

/** Generate a placement id from its natural key. */
export function generatePlacementId(
  nirf: NirfId,
  programLevel: string,
  graduatingYear: string,
): PlacementId {
  return `pl:${joinId([nirf, programLevel, graduatingYear])}` as PlacementId
}

/** Generate a faculty id from its natural key. */
export function generateFacultyId(nirf: NirfId, srNo: string): FacultyId {
  return `fac:${joinId([nirf, srNo])}` as FacultyId
}

/** Generate a research id from its natural key (institution + year). */
export function generateResearchId(nirf: NirfId, year: string): ResearchId {
  return `res:${joinId([nirf, year])}` as ResearchId
}

/** Generate a finance id from its natural key (institution + year). */
export function generateFinanceId(nirf: NirfId, year: string): FinanceId {
  return `fin:${joinId([nirf, year])}` as FinanceId
}
