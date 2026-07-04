/**
 * @module lib/knowledge/nirf2026/merge
 *
 * Merges normalized {@link Nirf2026Profile}s onto existing {@link CanonicalCollege}
 * records — ADDITIVELY, never mutating a college. Match cascade per college:
 *   1. NIRF Code  → college.nirfId          (canonical id; most reliable)
 *   2. CollegeCode → college.counsellingCodes (TNEA code; per the merge rule)
 *   3. normalized college / institute name   (fallback; last resort)
 * A college is claimed by at most one profile (first wins) → no duplicates. The
 * function is pure and produces a full merge audit. No ranking/eligibility logic.
 */

import type { CanonicalCollegeId } from '../ids'
import type { CanonicalCollege } from '../models'
import { comparisonKey } from '../normalization'
import type {
  MergeMethod,
  Nirf2026Dataset,
  Nirf2026Duplicate,
  Nirf2026MergeReport,
  Nirf2026Profile,
  Nirf2026Unmatched,
} from './types'

/** Numeric/text fields tracked for the "missing fields" section of the report. */
const TRACKED_FIELDS: readonly (keyof Nirf2026Profile)[] = [
  'nirfCode',
  'collegeCode',
  'instituteName',
  'avgMedianSalary',
  'avgPlacementPercentage',
  'avgPassingPercentage',
  'avgHigherStudiesPercentage',
  'careerOutcome',
  'idleOutputIndex',
  'totalIntake',
  'avgSeatsFilled',
  'avgWomenStudents',
  'avgOutsideStudents',
  'avgScholarshipPercentage',
  'ocCutoff',
  'district',
  'powerScore',
]

/**
 * Merge profiles against the existing college catalog. `rowsSkipped` is the count
 * of raw rows dropped before this step (e.g. blank college name), for the report.
 */
export function mergeNirf2026(
  profiles: readonly Nirf2026Profile[],
  colleges: readonly CanonicalCollege[],
  rowsSkipped = 0,
): Nirf2026Dataset {
  // ── Build match indices from the EXISTING catalog (never mutated). ──
  const byNirf = new Map<string, CanonicalCollege>()
  const byCode = new Map<string, CanonicalCollege>()
  const byName = new Map<string, CanonicalCollege>()
  for (const c of colleges) {
    if (c.nirfId && !byNirf.has(c.nirfId)) byNirf.set(String(c.nirfId).toUpperCase(), c)
    for (const code of c.counsellingCodes) {
      const k = String(code).trim()
      if (k && !byCode.has(k)) byCode.set(k, c)
    }
    // Index by the SAME comparison key the profile uses, so name-fallback is
    // consistent (the profile's nameKey is also `comparisonKey(...)`).
    const nameKey = comparisonKey(c.name)
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, c)
  }

  const match = (p: Nirf2026Profile): { college: CanonicalCollege; method: MergeMethod } | null => {
    if (p.nirfCode) {
      const c = byNirf.get(p.nirfCode)
      if (c) return { college: c, method: 'nirf' }
    }
    if (p.collegeCode) {
      const c = byCode.get(p.collegeCode)
      if (c) return { college: c, method: 'collegeCode' }
    }
    const c = byName.get(p.nameKey) ?? (p.instituteNameKey ? byName.get(p.instituteNameKey) : undefined)
    if (c) return { college: c, method: 'name' }
    return null
  }

  const byCollege = new Map<CanonicalCollegeId, Nirf2026Profile>()
  const claimedBy = new Map<CanonicalCollegeId, number>() // collegeId -> first row that claimed it
  const matchedByMethod: Record<MergeMethod, number> = { nirf: 0, collegeCode: 0, name: 0 }
  const unmatched: Nirf2026Unmatched[] = []
  const duplicates: Nirf2026Duplicate[] = []
  let matched = 0

  for (const p of profiles) {
    const m = match(p)
    if (!m) {
      unmatched.push({
        row: p.row,
        collegeName: p.collegeName,
        nirfCode: p.nirfCode,
        collegeCode: p.collegeCode,
        district: p.district,
      })
      continue
    }
    const existingRow = claimedBy.get(m.college.id)
    if (existingRow !== undefined) {
      // College already enriched by an earlier row → never duplicate; keep first.
      duplicates.push({
        row: p.row,
        collegeName: p.collegeName,
        collegeId: m.college.id,
        method: m.method,
        keptRow: existingRow,
      })
      continue
    }
    claimedBy.set(m.college.id, p.row)
    byCollege.set(m.college.id, p)
    matchedByMethod[m.method]++
    matched++
  }

  // ── Missing-field census across ALL profiles. ──
  const missingFields: Record<string, number> = {}
  for (const f of TRACKED_FIELDS) {
    missingFields[f] = profiles.filter((p) => p[f] === null).length
  }

  const report: Nirf2026MergeReport = {
    totalRows: profiles.length,
    matched,
    matchedByMethod,
    added: 0, // additive-safe: unmatched rows are candidates, not auto-added (see type)
    unmatched,
    duplicates,
    missingFields,
    rowsSkipped,
  }

  return { profiles, byCollege, report }
}

/** An empty dataset (used when the source file is absent). */
export function emptyNirf2026Dataset(): Nirf2026Dataset {
  return {
    profiles: [],
    byCollege: new Map(),
    report: {
      totalRows: 0,
      matched: 0,
      matchedByMethod: { nirf: 0, collegeCode: 0, name: 0 },
      added: 0,
      unmatched: [],
      duplicates: [],
      missingFields: {},
      rowsSkipped: 0,
    },
  }
}
