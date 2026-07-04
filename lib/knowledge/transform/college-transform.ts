/**
 * @module lib/knowledge/transform/college-transform
 *
 * Transforms the college master (`tn_nirf_299_colleges.csv`) and the NIRF
 * institution list (`institutions.csv`) into canonical colleges and institutions.
 *
 * Colleges are identified by NAME (see {@link generateCollegeId}), so distinct
 * colleges that share a `nirf_id` in the source are preserved. Master rows
 * establish name/city/state; institution rows backfill the NIRF linkage. True
 * name collisions are merged and reported as `duplicate` issues.
 */

import type { CsvRow } from '../csv'
import { generateCollegeId, type NirfId, nirfId, slugify } from '../ids'
import type { CanonicalCollege, CanonicalInstitution } from '../models'
import { normalizeCollegeName } from '../normalization'
import { requireFields, type ValidationIssue } from '../validation'
import { parseIntOrNull, textOrNull } from './values'

/** Output of a transform step: the models plus any issues encountered. */
export interface TransformOutput<T> {
  readonly items: readonly T[]
  readonly issues: readonly ValidationIssue[]
}

/** Mutable college accumulator used during the master + institution merge. */
interface CollegeDraft {
  readonly id: string
  readonly name: string
  readonly nameSlug: string
  city: string | null
  state: string | null
  nirfId: NirfId | null
  hasNirfData: boolean
}

/**
 * Build canonical colleges by merging the master list and NIRF institutions on
 * college name. Distinct colleges are preserved even when they share a `nirf_id`.
 */
export function transformColleges(
  masterRows: readonly CsvRow[],
  institutionRows: readonly CsvRow[],
): TransformOutput<CanonicalCollege> {
  const issues: ValidationIssue[] = []
  const byId = new Map<string, CollegeDraft>()

  for (const row of masterRows) {
    if (!requireFields('tn_nirf_299_colleges', row, ['name'], issues)) continue
    const { name, slug } = normalizeCollegeName(row.name)
    const id = generateCollegeId({ name })
    const nirf = textOrNull(row.nirf_id)
    const existing = byId.get(id)
    if (existing) {
      issues.push({
        severity: 'warning',
        kind: 'duplicate',
        source: 'tn_nirf_299_colleges',
        field: null,
        message: `duplicate college name merged: ${name}`,
      })
      if (!existing.nirfId && nirf) existing.nirfId = nirfId(nirf)
      if (!existing.city) existing.city = textOrNull(row.city)
      if (!existing.hasNirfData) existing.hasNirfData = (row.have_nirf_data ?? '').trim().toUpperCase() === 'YES'
      continue
    }
    byId.set(id, {
      id,
      name,
      nameSlug: slug,
      city: textOrNull(row.city),
      state: textOrNull(row.state),
      nirfId: nirf ? nirfId(nirf) : null,
      hasNirfData: (row.have_nirf_data ?? '').trim().toUpperCase() === 'YES',
    })
  }

  for (const row of institutionRows) {
    if (!requireFields('institutions', row, ['nirf_id', 'institution_name'], issues)) continue
    const { name, slug } = normalizeCollegeName(row.institution_name)
    const baseId = generateCollegeId({ name })
    const nirf = nirfId(row.nirf_id)
    const match = byId.get(baseId)

    // Merge only when the name matches AND the nirf is absent or identical, so we
    // never drop an institution's NIRF linkage (which would orphan its facts).
    if (match && (match.nirfId === null || match.nirfId === nirf)) {
      if (!match.nirfId) match.nirfId = nirf // backfill the linkage
      match.hasNirfData = true
      issues.push({
        severity: 'warning',
        kind: 'duplicate',
        source: 'institutions',
        field: null,
        message: `institution matched existing college: ${name}`,
      })
      continue
    }

    // No match, or a name clash with a different nirf: register a distinct college
    // (disambiguated by nirf) so every institution — and thus every fact — has a home.
    const id = match ? (`${baseId}:${slugify(nirf)}` as CollegeDraft['id']) : baseId
    if (byId.has(id)) continue
    byId.set(id, {
      id,
      name,
      nameSlug: slug,
      city: null,
      state: 'Tamil Nadu',
      nirfId: nirf,
      hasNirfData: true,
    })
  }

  const items: CanonicalCollege[] = [...byId.values()].map((d) => ({
    id: d.id as CanonicalCollege['id'],
    name: d.name,
    nameSlug: d.nameSlug,
    city: d.city,
    state: d.state,
    nirfId: d.nirfId,
    counsellingCodes: [],
    hasNirfData: d.hasNirfData,
  }))
  return { items, issues }
}

/** Build canonical institutions from the NIRF institution list. */
export function transformInstitutions(
  institutionRows: readonly CsvRow[],
): TransformOutput<CanonicalInstitution> {
  const issues: ValidationIssue[] = []
  const byNirf = new Map<string, CanonicalInstitution>()

  for (const row of institutionRows) {
    if (!requireFields('institutions', row, ['nirf_id', 'institution_name'], issues)) continue
    const nirf = nirfId(row.nirf_id)
    byNirf.set(nirf, {
      nirfId: nirf,
      name: normalizeCollegeName(row.institution_name).name,
      category: textOrNull(row.nirf_category),
      submissionYear: parseIntOrNull(row.submission_year),
      pincode: textOrNull(row.pincode),
      phdFulltimePursuing: parseIntOrNull(row.phd_fulltime_pursuing),
      phdParttimePursuing: parseIntOrNull(row.phd_parttime_pursuing),
    })
  }

  return { items: [...byNirf.values()], issues }
}
