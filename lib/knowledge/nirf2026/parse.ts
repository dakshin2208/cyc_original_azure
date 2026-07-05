/**
 * @module lib/knowledge/nirf2026/parse
 *
 * Parses + normalizes raw `2026_final_NIRF_data.csv` rows into
 * {@link Nirf2026Profile}s. Pure and I/O-free (operates on already-parsed
 * header-keyed rows). Blank cells become `null`; numbers are coerced; names are
 * reduced to a `comparisonKey` for matching. No business logic.
 */

import type { CsvRow } from '../csv'
import { comparisonKey } from '../normalization'
import type { Nirf2026Profile } from './types'

/** Exact source header names (kept verbatim; the CSV parser only trims them). */
export const NIRF2026_HEADERS = {
  nirfCode: 'NIRF Code',
  collegeCode: 'CollegeCode',
  instituteName: 'instituteName',
  collegeName: 'collegeName',
  avgMedianSalary: 'avgMedianSalary',
  avgPlacementPercentage: 'avgPlacementPercentage',
  avgPassingPercentage: 'avgPassingPercentage',
  avgHigherStudiesPercentage: 'avgHigherStudiesPercentage',
  idleOutputIndex: 'IdleOutputIndex',
  avgScholarshipPercentage: 'avgScholarshipPercentage',
  totalIntake: 'totalIntake',
  avgSeatsFilled: 'avgSeatsFilled',
  avgWomenStudents: 'avgWomenStudents',
  avgOutsideStudents: 'avgOutsideStudents',
  ocCutoff: 'ocCutoff',
  state: 'State',
  district: 'District',
  powerScore: 'PowerScore',
  careerOutcome: 'careerOutcome',
} as const

const str = (v: string | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Coerce to a finite number, or `null` for blank/non-numeric (keeps a real 0). */
const num = (v: string | undefined): number | null => {
  const t = (v ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Normalize raw rows into profiles. Rows without a college name are skipped and
 * counted (returned separately) so the merge report can surface them.
 */
export function parseNirf2026(rows: readonly CsvRow[]): {
  readonly profiles: Nirf2026Profile[]
  readonly skipped: number
} {
  const H = NIRF2026_HEADERS
  const profiles: Nirf2026Profile[] = []
  let skipped = 0

  rows.forEach((r, i) => {
    const collegeName = str(r[H.collegeName])
    if (!collegeName) {
      skipped++
      return
    }
    const instituteName = str(r[H.instituteName])
    const nirfCode = str(r[H.nirfCode])
    profiles.push({
      row: i + 1,
      nirfCode: nirfCode ? nirfCode.toUpperCase() : null,
      collegeCode: str(r[H.collegeCode]),
      instituteName,
      collegeName,
      nameKey: comparisonKey(collegeName),
      instituteNameKey: instituteName ? comparisonKey(instituteName) : null,
      avgMedianSalary: num(r[H.avgMedianSalary]),
      avgPlacementPercentage: num(r[H.avgPlacementPercentage]),
      avgPassingPercentage: num(r[H.avgPassingPercentage]),
      avgHigherStudiesPercentage: num(r[H.avgHigherStudiesPercentage]),
      careerOutcome: num(r[H.careerOutcome]),
      idleOutputIndex: num(r[H.idleOutputIndex]),
      totalIntake: num(r[H.totalIntake]),
      avgSeatsFilled: num(r[H.avgSeatsFilled]),
      avgWomenStudents: num(r[H.avgWomenStudents]),
      avgOutsideStudents: num(r[H.avgOutsideStudents]),
      avgScholarshipPercentage: num(r[H.avgScholarshipPercentage]),
      ocCutoff: num(r[H.ocCutoff]),
      state: str(r[H.state]),
      district: str(r[H.district]),
      powerScore: num(r[H.powerScore]),
    })
  })

  return { profiles, skipped }
}
