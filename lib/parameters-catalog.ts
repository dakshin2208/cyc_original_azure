// lib/parameters-catalog.ts
// Single source of truth for the NEW computed parameters exposed in college search.
// These are the scalar (single-value) parameters derived from lib/parameters.ts and
// served by /api/college-parameters. Nested/array parameters (per-branch closing ranks,
// cutoff volatility, fill-rate-by-year) are intentionally excluded from the search table.
//
// Used by:
//   - app/client.tsx            → renders the parameter selector
//   - components/results-table.tsx → fetches, formats, sorts the new columns
//   - lib/college-service.ts    → getParameterLabel() fallback

import type { CollegeParameters } from '@/lib/parameters'

export type ParamFormat = 'percent' | 'currency' | 'number' | 'ratio' | 'text'

// Which top-level section of the API response a parameter lives in
export type ApiSection =
  | 'faculty'
  | 'admissions'
  | 'financial'
  | 'research'
  | 'student_composition'
  | 'infrastructure'
  | 'cross_schema'

export interface NewParam {
  id: string            // unique id used in URL/state/column key
  label: string         // column header + selector label
  description: string   // selector helper text
  section: ApiSection   // which API section it comes from
  field: string         // field name within that section
  format: ParamFormat
}

export interface NewParamGroup {
  section: ApiSection
  sectionLabel: string
  params: NewParam[]
}

// ─── The catalog ─────────────────────────────────────────────────────────────

export const NEW_PARAMETER_GROUPS: NewParamGroup[] = [
  {
    section: 'faculty',
    sectionLabel: 'Faculty Quality',
    params: [
      { id: 'phd_pct',             label: 'PhD Faculty %',           description: 'Share of faculty holding a PhD',                 section: 'faculty', field: 'phd_pct',             format: 'percent' },
      { id: 'female_faculty_pct',  label: 'Female Faculty %',        description: 'Share of faculty who are women',                 section: 'faculty', field: 'female_faculty_pct',  format: 'percent' },
      { id: 'avg_experience_years',label: 'Avg Faculty Experience',  description: 'Average years of experience (active faculty)',   section: 'faculty', field: 'avg_experience_years',format: 'number'  },
      { id: 'retention_rate_pct',  label: 'Faculty Retention %',     description: 'Share of faculty currently working',            section: 'faculty', field: 'retention_rate_pct',  format: 'percent' },
      { id: 'salary_per_faculty',  label: 'Salary per Faculty',      description: 'Annual salary spend per faculty member',         section: 'faculty', field: 'salary_per_faculty',  format: 'currency'},
      { id: 'phd_pursuing_pct',    label: 'Faculty Pursuing PhD %',  description: 'Share of faculty currently pursuing a PhD',      section: 'faculty', field: 'phd_pursuing_pct',    format: 'percent' },
      { id: 'total_faculty',       label: 'Total Faculty',           description: 'Total faculty count',                           section: 'faculty', field: 'total_faculty',       format: 'number'  },
    ],
  },
  {
    section: 'admissions',
    sectionLabel: 'Admissions Demand (TNEA)',
    params: [
      { id: 'fill_rate_5yr_avg',  label: 'Fill Rate (5yr avg) %', description: 'Average seat fill rate over 5 years',           section: 'admissions', field: 'fill_rate_5yr_avg', format: 'percent' },
      { id: 'intake_growth_pct',  label: 'Intake Growth %',       description: 'Sanctioned intake growth (oldest→current)',     section: 'admissions', field: 'intake_growth_pct', format: 'percent' },
      { id: 'intake_current',     label: 'Current Intake',        description: 'Latest sanctioned UG intake',                   section: 'admissions', field: 'intake_current',    format: 'number'  },
    ],
  },
  {
    section: 'financial',
    sectionLabel: 'Financial Investment',
    params: [
      { id: 'spend_per_student',        label: 'Spend per Student',        description: 'Annual operational spend per student',     section: 'financial', field: 'spend_per_student',        format: 'currency' },
      { id: 'lab_spend_per_student',    label: 'Lab Spend per Student',    description: 'Lab/equipment spend per student',          section: 'financial', field: 'lab_spend_per_student',    format: 'currency' },
      { id: 'lab_investment_trend_pct', label: 'Lab Investment Trend %',   description: 'Year-on-year change in lab investment',    section: 'financial', field: 'lab_investment_trend_pct', format: 'percent'  },
      { id: 'salary_growth_pct',        label: 'Salary Growth %',          description: 'Year-on-year salary spend growth',         section: 'financial', field: 'salary_growth_pct',        format: 'percent'  },
      { id: 'maintenance_growth_pct',   label: 'Maintenance Growth %',     description: 'Year-on-year maintenance spend growth',    section: 'financial', field: 'maintenance_growth_pct',   format: 'percent'  },
      { id: 'seminar_spend_per_student',label: 'Seminar Spend per Student',description: 'Seminar/workshop spend per student',       section: 'financial', field: 'seminar_spend_per_student',format: 'currency' },
    ],
  },
  {
    section: 'research',
    sectionLabel: 'Research & Innovation',
    params: [
      { id: 'patents_per_100_faculty',       label: 'Patents per 100 Faculty',  description: 'Patents published per 100 faculty',     section: 'research', field: 'patents_per_100_faculty',       format: 'number'   },
      { id: 'sponsored_research_per_faculty',label: 'Sponsored Research/Faculty',description: 'Sponsored research funds per faculty',  section: 'research', field: 'sponsored_research_per_faculty',format: 'currency' },
      { id: 'consultancy_revenue',           label: 'Consultancy Revenue',      description: 'Latest-year consultancy revenue',       section: 'research', field: 'consultancy_revenue',           format: 'currency' },
      { id: 'phd_output_avg_per_year',       label: 'PhD Output / Year',        description: 'Average PhDs graduated per year',       section: 'research', field: 'phd_output_avg_per_year',       format: 'number'   },
      { id: 'research_score',                label: 'Research Score (0-100)',   description: 'Composite research score',              section: 'research', field: 'research_score',                format: 'number'   },
    ],
  },
  {
    section: 'student_composition',
    sectionLabel: 'Student Composition',
    params: [
      { id: 'reserved_category_pct',     label: 'Reserved Category %',     description: 'Socially challenged students share',  section: 'student_composition', field: 'reserved_category_pct',     format: 'percent' },
      { id: 'economically_backward_pct', label: 'Economically Backward %', description: 'Economically backward students share',section: 'student_composition', field: 'economically_backward_pct', format: 'percent' },
      { id: 'open_category_pct',         label: 'Open Category %',         description: 'Open (full-fee) students share',      section: 'student_composition', field: 'open_category_pct',         format: 'percent' },
      { id: 'pg_to_ug_ratio',            label: 'PG:UG Ratio',             description: 'Postgraduate to undergraduate ratio', section: 'student_composition', field: 'pg_to_ug_ratio',            format: 'ratio'   },
    ],
  },
  {
    section: 'infrastructure',
    sectionLabel: 'Infrastructure & Accreditation',
    params: [
      { id: 'naac_score',                 label: 'NAAC Score',                description: 'NAAC accreditation score',           section: 'infrastructure', field: 'naac_score',                 format: 'number' },
      { id: 'naac_status',                label: 'NAAC Status',               description: 'NAAC validity status',               section: 'infrastructure', field: 'naac_status',                format: 'text'   },
      { id: 'green_campus_score',         label: 'Green Campus Score (0-6)',  description: 'Sustainability practices count',     section: 'infrastructure', field: 'green_campus_score',         format: 'number' },
      { id: 'accessibility_score',        label: 'Accessibility Score (0-3)', description: 'Disability-access facilities count', section: 'infrastructure', field: 'accessibility_score',        format: 'number' },
      { id: 'edp_programs_count',         label: 'EDP Programs',              description: 'Executive dev programs run',         section: 'infrastructure', field: 'edp_programs_count',         format: 'number' },
      { id: 'edp_participants_per_program',label: 'EDP Participants/Program', description: 'Avg participants per EDP program',   section: 'infrastructure', field: 'edp_participants_per_program',format: 'number' },
    ],
  },
  {
    section: 'cross_schema',
    sectionLabel: 'Cross-Schema Indices',
    params: [
      { id: 'placement_yield_pct',       label: 'Placement Yield %',        description: 'Placed vs avg yearly allotment',      section: 'cross_schema', field: 'placement_yield_pct',       format: 'percent' },
      { id: 'demand_quality_index',      label: 'Demand-Quality Index',     description: 'Avg of fill-rate and placement %',    section: 'cross_schema', field: 'demand_quality_index',      format: 'number'  },
      { id: 'intake_outcome_efficiency', label: 'Intake-Outcome Efficiency',description: 'Outcome growth vs intake growth',     section: 'cross_schema', field: 'intake_outcome_efficiency', format: 'ratio'   },
    ],
  },
]

// Flat list + lookup of all new params
export const NEW_PARAMS: NewParam[] = NEW_PARAMETER_GROUPS.flatMap((g) => g.params)
export const NEW_PARAM_BY_ID: Record<string, NewParam> = Object.fromEntries(
  NEW_PARAMS.map((p) => [p.id, p]),
)
export const NEW_PARAM_IDS: Set<string> = new Set(NEW_PARAMS.map((p) => p.id))

export function isNewParam(id: string): boolean {
  return NEW_PARAM_IDS.has(id)
}

// Numeric params sort with extractNumericValue; text params sort as strings.
export function isNewNumericParam(id: string): boolean {
  const p = NEW_PARAM_BY_ID[id]
  return !!p && p.format !== 'text'
}

// API sections needed to satisfy a set of selected param ids
export function sectionsForParams(ids: string[]): ApiSection[] {
  const set = new Set<ApiSection>()
  for (const id of ids) {
    const p = NEW_PARAM_BY_ID[id]
    if (p) set.add(p.section)
  }
  return [...set]
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const PLACEHOLDER = '-'

export function formatNewParamValue(id: string, raw: unknown): string {
  const p = NEW_PARAM_BY_ID[id]
  if (!p) return PLACEHOLDER
  if (raw === null || raw === undefined || raw === '') return PLACEHOLDER

  if (p.format === 'text') return String(raw)

  const n = typeof raw === 'number' ? raw : Number(raw)
  if (isNaN(n)) return PLACEHOLDER

  switch (p.format) {
    case 'percent':
      return `${n}%`
    case 'currency':
      return `₹${Math.round(n).toLocaleString('en-IN')}`
    case 'ratio':
      return n.toFixed(2)
    case 'number':
    default:
      return Number.isInteger(n) ? n.toLocaleString('en-IN') : String(n)
  }
}

// Pull the raw value for a param id out of a CollegeParameters response
export function extractNewParamValue(cp: CollegeParameters, id: string): unknown {
  const p = NEW_PARAM_BY_ID[id]
  if (!p) return null
  const section = cp[p.section] as Record<string, unknown> | null | undefined
  if (!section) return null
  return section[p.field] ?? null
}

// ─── Client-side fetch of computed parameters via the API route ───────────────

export interface FetchComputedResult {
  values: Record<string, string>   // paramId → formatted display string
  ok: boolean
}

export async function fetchComputedParameters(
  nirfId: string | null,
  counsellingCode: string | null,
  paramIds: string[],
): Promise<FetchComputedResult> {
  if ((!nirfId && !counsellingCode) || paramIds.length === 0) {
    return { values: {}, ok: true }
  }
  const sections = sectionsForParams(paramIds)
  const qs = new URLSearchParams()
  if (nirfId) qs.set('nirf_id', nirfId)
  if (counsellingCode) qs.set('counselling_code', counsellingCode)
  if (sections.length) qs.set('sections', sections.join(','))

  try {
    const res = await fetch(`/api/college-parameters?${qs.toString()}`)
    if (!res.ok) return { values: {}, ok: false }
    const cp = (await res.json()) as CollegeParameters
    const values: Record<string, string> = {}
    for (const id of paramIds) {
      values[id] = formatNewParamValue(id, extractNewParamValue(cp, id))
    }
    return { values, ok: true }
  } catch {
    return { values: {}, ok: false }
  }
}
