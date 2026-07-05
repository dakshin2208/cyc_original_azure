/**
 * @module lib/knowledge/transform/facts-transform
 *
 * Transforms the NIRF fact sources into canonical placement, faculty, research,
 * and finance records. Research merges four sources and finance merges two,
 * keyed by (institution, normalized year). `collegeId` is left `null` here and
 * resolved later by the warehouse builder via the crosswalk.
 */

import type { CsvRow } from '../csv'
import {
  generateFacultyId,
  generateFinanceId,
  generatePlacementId,
  generateResearchId,
  nirfId,
} from '../ids'
import type {
  CanonicalFaculty,
  CanonicalFinance,
  CanonicalPlacement,
  CanonicalResearch,
} from '../models'
import { requireFields, type ValidationIssue } from '../validation'
import type { TransformOutput } from './college-transform'
import {
  normalizeYear,
  parseBoolOrNull,
  parseFloatOrNull,
  parseIntOrNull,
  textOrNull,
} from './values'

/** Transform placement/higher-studies rows. */
export function transformPlacements(rows: readonly CsvRow[]): TransformOutput<CanonicalPlacement> {
  const issues: ValidationIssue[] = []
  const items: CanonicalPlacement[] = []
  for (const row of rows) {
    if (!requireFields('placement_higher_studies', row, ['nirf_id', 'program_level', 'graduating_year'], issues)) continue
    const nirf = nirfId(row.nirf_id)
    items.push({
      id: generatePlacementId(nirf, row.program_level, row.graduating_year),
      collegeId: null,
      nirfId: nirf,
      programLevel: row.program_level.trim(),
      graduatingYear: row.graduating_year.trim(),
      firstYearIntake: parseIntOrNull(row.first_year_intake),
      studentsPlaced: parseIntOrNull(row.students_placed),
      medianSalary: parseIntOrNull(row.median_salary),
      studentsHigherStudies: parseIntOrNull(row.students_higher_studies),
    })
  }
  return { items, issues }
}

/** Transform faculty rows. */
export function transformFaculty(rows: readonly CsvRow[]): TransformOutput<CanonicalFaculty> {
  const issues: ValidationIssue[] = []
  const items: CanonicalFaculty[] = []
  for (const row of rows) {
    if (!requireFields('faculty', row, ['nirf_id', 'sr_no'], issues)) continue
    const nirf = nirfId(row.nirf_id)
    items.push({
      id: generateFacultyId(nirf, row.sr_no),
      collegeId: null,
      nirfId: nirf,
      name: textOrNull(row.name) ?? '',
      designation: textOrNull(row.designation),
      gender: textOrNull(row.gender),
      qualification: textOrNull(row.qualification),
      experienceMonths: parseIntOrNull(row.experience_months),
      currentlyWorking: parseBoolOrNull(row.currently_working),
    })
  }
  return { items, issues }
}

/** Accumulator for the multi-source research merge. */
type ResearchDraft = {
  nirf: string
  year: string
  sponsoredProjects: number | null
  sponsoredAmount: number | null
  consultancyProjects: number | null
  consultancyAmount: number | null
  patentsPublished: number | null
  patentsGranted: number | null
  phdGraduated: number | null
}

/**
 * Merge the four research sources into canonical research records, keyed by
 * (institution, normalized start year).
 */
export function transformResearch(
  sponsored: readonly CsvRow[],
  consultancy: readonly CsvRow[],
  ipr: readonly CsvRow[],
  phd: readonly CsvRow[],
): TransformOutput<CanonicalResearch> {
  const drafts = new Map<string, ResearchDraft>()
  const draft = (nirf: string, year: string): ResearchDraft => {
    const key = `${nirf}:${year}`
    let d = drafts.get(key)
    if (!d) {
      d = {
        nirf,
        year,
        sponsoredProjects: null,
        sponsoredAmount: null,
        consultancyProjects: null,
        consultancyAmount: null,
        patentsPublished: null,
        patentsGranted: null,
        phdGraduated: null,
      }
      drafts.set(key, d)
    }
    return d
  }

  for (const row of sponsored) {
    const year = normalizeYear(row.financial_year)
    if (!row.nirf_id || !year) continue
    const d = draft(row.nirf_id.trim(), year)
    d.sponsoredProjects = parseIntOrNull(row.total_projects)
    d.sponsoredAmount = parseFloatOrNull(row.total_amount_received)
  }
  for (const row of consultancy) {
    const year = normalizeYear(row.financial_year)
    if (!row.nirf_id || !year) continue
    const d = draft(row.nirf_id.trim(), year)
    d.consultancyProjects = parseIntOrNull(row.total_projects)
    d.consultancyAmount = parseFloatOrNull(row.total_amount_received)
  }
  for (const row of ipr) {
    const year = normalizeYear(row.calendar_year)
    if (!row.nirf_id || !year) continue
    const d = draft(row.nirf_id.trim(), year)
    d.patentsPublished = parseIntOrNull(row.patents_published)
    d.patentsGranted = parseIntOrNull(row.patents_granted)
  }
  for (const row of phd) {
    const year = normalizeYear(row.academic_year)
    if (!row.nirf_id || !year) continue
    const d = draft(row.nirf_id.trim(), year)
    const ft = parseIntOrNull(row.fulltime_graduated) ?? 0
    const pt = parseIntOrNull(row.parttime_graduated) ?? 0
    d.phdGraduated = ft + pt
  }

  const items: CanonicalResearch[] = [...drafts.values()].map((d) => {
    const nirf = nirfId(d.nirf)
    return {
      id: generateResearchId(nirf, d.year),
      collegeId: null,
      nirfId: nirf,
      year: d.year,
      sponsoredProjects: d.sponsoredProjects,
      sponsoredAmount: d.sponsoredAmount,
      consultancyProjects: d.consultancyProjects,
      consultancyAmount: d.consultancyAmount,
      patentsPublished: d.patentsPublished,
      patentsGranted: d.patentsGranted,
      phdGraduated: d.phdGraduated,
    }
  })
  return { items, issues: [] }
}

/** Merge the two finance sources into canonical finance records. */
export function transformFinance(
  operational: readonly CsvRow[],
  capital: readonly CsvRow[],
): TransformOutput<CanonicalFinance> {
  const drafts = new Map<
    string,
    { nirf: string; year: string; op: CsvRow | null; cap: CsvRow | null }
  >()
  const draft = (nirf: string, year: string) => {
    const key = `${nirf}:${year}`
    let d = drafts.get(key)
    if (!d) {
      d = { nirf, year, op: null, cap: null }
      drafts.set(key, d)
    }
    return d
  }

  for (const row of operational) {
    const year = normalizeYear(row.academic_year)
    if (!row.nirf_id || !year) continue
    draft(row.nirf_id.trim(), year).op = row
  }
  for (const row of capital) {
    const year = normalizeYear(row.academic_year)
    if (!row.nirf_id || !year) continue
    draft(row.nirf_id.trim(), year).cap = row
  }

  const items: CanonicalFinance[] = [...drafts.values()].map((d) => {
    const nirf = nirfId(d.nirf)
    return {
      id: generateFinanceId(nirf, d.year),
      collegeId: null,
      nirfId: nirf,
      year: d.year,
      salaries: parseFloatOrNull(d.op?.salaries),
      maintenance: parseFloatOrNull(d.op?.maintenance_infrastructure),
      seminars: parseFloatOrNull(d.op?.seminars_workshops),
      library: parseFloatOrNull(d.cap?.library),
      labEquipment: parseFloatOrNull(d.cap?.lab_equipment_software),
      otherCapital: parseFloatOrNull(d.cap?.other_capital_assets),
    }
  })
  return { items, issues: [] }
}
