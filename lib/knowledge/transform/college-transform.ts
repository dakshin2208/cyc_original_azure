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

/**
 * The district named by a NIRF submission filename — "… Karuppur Salem District 636011.pdf"
 * → "Salem". The district is the word immediately before "District". Used ONLY to tell
 * same-name colleges apart (the Government Colleges of Engineering); returns `null` when the
 * filename does not state one, in which case no guess is made.
 */
function districtFromSourceFile(sourceFile: string | null): string | null {
  if (!sourceFile) return null
  const m = /([A-Za-z]+)\s+District\b/i.exec(sourceFile)
  return m ? m[1] : null
}

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

  // IDENTITY = normalized name + CITY. The master's `nirf_id` must NOT be part of the key:
  // it is unreliable (dozens of codes are shared by unrelated colleges — e.g. all four
  // Government Colleges of Engineering carry one code), so keying on it both fuses distinct
  // colleges and splits single ones. Two rows are the SAME college only when the name AND
  // the city match; the same name in a DIFFERENT city is a DIFFERENT college (Government
  // College of Engineering at Krishnagiri / Tirunelveli / Salem / Theni are four colleges).
  // Only a colliding name is city-suffixed, so every other college keeps its plain
  // `col:<slug>` id and no existing reference churns.
  const citiesBySlug = new Map<string, Set<string>>()
  for (const row of masterRows) {
    if (!row.name) continue
    const { slug } = normalizeCollegeName(row.name)
    const set = citiesBySlug.get(slug) ?? new Set<string>()
    set.add(slugify(textOrNull(row.city) ?? ''))
    citiesBySlug.set(slug, set)
  }
  const masterId = (name: string, slug: string, city: string | null): string => {
    const base = generateCollegeId({ name }) as string
    const citySlug = slugify(city ?? '')
    return (citiesBySlug.get(slug)?.size ?? 0) > 1 && citySlug ? `${base}:${citySlug}` : base
  }

  for (const row of masterRows) {
    if (!requireFields('tn_nirf_299_colleges', row, ['name'], issues)) continue
    const { name, slug } = normalizeCollegeName(row.name)
    const id = masterId(name, slug, textOrNull(row.city))
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

  // Index the master colleges by name-slug so an institution row can be attached to the
  // college it actually names.
  const bySlug = new Map<string, CollegeDraft[]>()
  for (const draft of byId.values()) {
    const list = bySlug.get(draft.nameSlug) ?? []
    list.push(draft)
    bySlug.set(draft.nameSlug, list)
  }
  const linked = new Set<string>() // drafts already given an authoritative code (first wins)

  for (const row of institutionRows) {
    if (!requireFields('institutions', row, ['nirf_id', 'institution_name'], issues)) continue
    const { name, slug } = normalizeCollegeName(row.institution_name)
    const nirf = nirfId(row.nirf_id)
    const candidates = bySlug.get(slug) ?? []

    // `institutions.csv` is the AUTHORITATIVE name↔NIRF-code mapping (it comes from the NIRF
    // submissions themselves); the master's `nirf_id` is not. So when the name identifies
    // exactly ONE college, bind the code to THAT college — overwriting the master's unreliable
    // value — rather than registering a second, factless ghost record for the same college.
    // (This is what split "Coimbatore Institute of Technology" in two: the master carried
    // another college's code, so the real, data-bearing CIT was registered separately.)
    if (candidates.length === 1) {
      const match = candidates[0]
      if (!linked.has(match.id)) {
        match.nirfId = nirf
        match.hasNirfData = true
        linked.add(match.id)
      }
      issues.push({
        severity: 'warning',
        kind: 'duplicate',
        source: 'institutions',
        field: null,
        message: `institution matched existing college: ${name}`,
      })
      continue
    }

    // Several same-name colleges (the Government Colleges of Engineering). The name alone
    // cannot tell them apart, but the NIRF submission filename states the district
    // ("… Karuppur Salem District 636011.pdf"), so bind the code to the college in THAT
    // district. Deterministic and source-derived — never a guess.
    if (candidates.length > 1) {
      const district = districtFromSourceFile(textOrNull(row.source_file))
      const key = slugify(district ?? '')
      const inDistrict = key ? candidates.filter((c) => slugify(c.city ?? '') === key) : []
      if (inDistrict.length === 1 && !linked.has(inDistrict[0].id)) {
        inDistrict[0].nirfId = nirf
        inDistrict[0].hasNirfData = true
        linked.add(inDistrict[0].id)
        continue
      }
    }

    // Still ambiguous, or unknown to the master: register a distinct college —
    // disambiguated by its NIRF code — so its facts still have a home.
    const baseId = generateCollegeId({ name }) as string
    const id = (candidates.length > 1 ? `${baseId}:${slugify(nirf)}` : baseId) as CollegeDraft['id']
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
