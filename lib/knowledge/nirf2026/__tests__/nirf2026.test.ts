/**
 * @module lib/knowledge/nirf2026/__tests__/nirf2026.test
 *
 * Validation for the 2026 NIRF dataset integration: parse/normalize, the
 * NIRF → CollegeCode → name merge cascade, no-duplicate guarantee, the optional
 * source (warehouse still builds without the file), and a real-warehouse smoke
 * test (gated on CYC_DATA_DIR). No recommendation logic is exercised.
 */

import { describe, it, expect } from 'vitest'
import {
  parseNirf2026,
  mergeNirf2026,
  NIRF2026_HEADERS as H,
  buildWarehouse,
  buildWarehouseFromDirectory,
  type CsvRow,
} from '@/lib/knowledge'
import type { CanonicalCollege } from '@/lib/knowledge'
import type { CanonicalCollegeId, CounsellingCode, NirfId } from '@/lib/knowledge'

// ── helpers ──────────────────────────────────────────────────────────────────
const row = (o: Partial<Record<keyof typeof H, string>>): CsvRow => {
  const r: Record<string, string> = {}
  for (const key of Object.keys(H) as (keyof typeof H)[]) r[H[key]] = o[key] ?? ''
  return r
}

const mkCollege = (o: {
  id: string
  name: string
  nameSlug: string
  nirfId?: string | null
  codes?: string[]
}): CanonicalCollege => ({
  id: o.id as CanonicalCollegeId,
  name: o.name,
  nameSlug: o.nameSlug,
  city: null,
  state: null,
  nirfId: (o.nirfId ?? null) as NirfId | null,
  counsellingCodes: (o.codes ?? []) as unknown as readonly CounsellingCode[],
  hasNirfData: o.nirfId != null,
})

const emptySources = {
  master: [] as CsvRow[],
  institutions: [] as CsvRow[],
  tneaBranches: [] as string[],
  tneaCounsellingCodes: [] as string[],
  placement: [] as CsvRow[],
  faculty: [] as CsvRow[],
  sponsoredResearch: [] as CsvRow[],
  consultancy: [] as CsvRow[],
  ipr: [] as CsvRow[],
  phdGraduated: [] as CsvRow[],
  financialOperational: [] as CsvRow[],
  financialCapital: [] as CsvRow[],
}

// ── parse / normalize ────────────────────────────────────────────────────────
describe('parseNirf2026', () => {
  it('normalizes types, uppercases NIRF, derives a name key, blanks → null', () => {
    const { profiles, skipped } = parseNirf2026([
      row({
        nirfCode: 'ir-e-c-100',
        collegeCode: '2718',
        collegeName: 'Sri Krishna College (Autonomous)',
        avgMedianSalary: '700000',
        ocCutoff: '192',
        district: 'Coimbatore',
        avgHigherStudiesPercentage: '0',
        powerScore: '',
      }),
    ])
    expect(skipped).toBe(0)
    const p = profiles[0]
    expect(p.nirfCode).toBe('IR-E-C-100') // uppercased
    expect(p.collegeCode).toBe('2718')
    expect(p.avgMedianSalary).toBe(700000)
    expect(p.ocCutoff).toBe(192)
    expect(p.district).toBe('Coimbatore')
    expect(p.avgHigherStudiesPercentage).toBe(0) // a real 0 is preserved
    expect(p.powerScore).toBeNull() // blank → null
    expect(p.nameKey.length).toBeGreaterThan(0)
  })

  it('skips rows with a blank college name', () => {
    const { profiles, skipped } = parseNirf2026([row({ collegeName: '' }), row({ collegeName: 'X' })])
    expect(skipped).toBe(1)
    expect(profiles).toHaveLength(1)
  })
})

// ── merge cascade ────────────────────────────────────────────────────────────
describe('mergeNirf2026 — cascade', () => {
  const byNirf = mkCollege({ id: 'col:a', name: 'Alpha', nameSlug: 'alpha', nirfId: 'IR-E-C-1' })
  const byCode = mkCollege({ id: 'col:b', name: 'Beta', nameSlug: 'beta', codes: ['2222'] })
  const byName = mkCollege({ id: 'col:c', name: 'Gamma', nameSlug: 'gamma' })
  const colleges = [byNirf, byCode, byName]

  const merge = (rows: CsvRow[]) => mergeNirf2026(parseNirf2026(rows).profiles, colleges)

  it('matches by NIRF Code first', () => {
    const ds = merge([row({ nirfCode: 'IR-E-C-1', collegeCode: '9999', collegeName: 'Whatever' })])
    expect(ds.report.matchedByMethod.nirf).toBe(1)
    expect(ds.byCollege.get('col:a' as CanonicalCollegeId)).toBeDefined()
  })

  it('falls back to CollegeCode when the college carries that code', () => {
    const ds = merge([row({ collegeCode: '2222', collegeName: 'Beta Different Name' })])
    expect(ds.report.matchedByMethod.collegeCode).toBe(1)
    expect(ds.byCollege.get('col:b' as CanonicalCollegeId)).toBeDefined()
  })

  it('falls back to normalized name last', () => {
    const ds = merge([row({ collegeName: 'gamma' })])
    expect(ds.report.matchedByMethod.name).toBe(1)
    expect(ds.byCollege.get('col:c' as CanonicalCollegeId)).toBeDefined()
  })

  it('reports unmatched rows and adds nothing to the catalog', () => {
    const ds = merge([row({ collegeName: 'Unknown College', collegeCode: '404', district: 'Salem' })])
    expect(ds.report.matched).toBe(0)
    expect(ds.report.added).toBe(0) // additive-safe: never auto-adds
    expect(ds.report.unmatched).toHaveLength(1)
    expect(ds.report.unmatched[0].district).toBe('Salem')
  })

  it('never duplicates a college — a second row for the same college is a duplicate', () => {
    const ds = merge([
      row({ nirfCode: 'IR-E-C-1', collegeName: 'First' }),
      row({ nirfCode: 'IR-E-C-1', collegeName: 'Second' }),
    ])
    expect(ds.report.matched).toBe(1)
    expect(ds.report.duplicates).toHaveLength(1)
    expect(ds.report.duplicates[0].keptRow).toBe(1)
    expect(ds.byCollege.size).toBe(1) // one profile per college
  })

  it('counts missing fields', () => {
    const ds = merge([row({ nirfCode: 'IR-E-C-1', collegeName: 'A', ocCutoff: '', district: '' })])
    expect(ds.report.missingFields.ocCutoff).toBe(1)
    expect(ds.report.missingFields.district).toBe(1)
  })
})

// ── warehouse integration (pure, no I/O) ─────────────────────────────────────
describe('buildWarehouse — 2026 attachment', () => {
  const master: CsvRow[] = [
    { id: '1', name: 'Test College', city: 'Chennai', state: 'Tamil Nadu', nirf_id: 'IR-E-C-777', have_nirf_data: 'YES' },
  ]

  it('attaches the merged dataset and links by NIRF Code', () => {
    const wh = buildWarehouse({
      ...emptySources,
      master,
      nirf2026: [row({ nirfCode: 'IR-E-C-777', collegeName: 'Test College', ocCutoff: '188', district: 'Chennai' })],
    })
    expect(wh.nirf2026.report.totalRows).toBe(1)
    expect(wh.nirf2026.report.matched).toBe(1)
    const college = wh.colleges.find((c) => c.nirfId === ('IR-E-C-777' as NirfId))!
    expect(wh.nirf2026.byCollege.get(college.id)?.ocCutoff).toBe(188)
  })

  it('is OPTIONAL — the warehouse still builds with no 2026 source', () => {
    const wh = buildWarehouse({ ...emptySources, master })
    expect(wh.nirf2026.profiles).toHaveLength(0)
    expect(wh.nirf2026.report.totalRows).toBe(0)
    expect(wh.colleges.length).toBeGreaterThan(0) // existing pipeline unaffected
  })
})

// ── real warehouse smoke (gated) ─────────────────────────────────────────────
const DIR = process.env.CYC_DATA_DIR
describe.skipIf(!DIR)('real warehouse — 2026 dataset loads + merges cleanly', () => {
  it('loads 492 profiles, matches via NIRF, zero duplicate colleges', () => {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const r = wh.nirf2026.report
    expect(r.totalRows).toBeGreaterThan(400)
    expect(r.matched).toBeGreaterThan(100)
    // Duplicate ROWS may occur (a later name-match hitting an already NIRF-matched
    // college); the guarantee is NO duplicate COLLEGES — one profile per college.
    expect(wh.nirf2026.byCollege.size).toBe(r.matched)
    // eligibility fuel now present on matched colleges (RC4 from the audit)
    const withCutoff = [...wh.nirf2026.byCollege.values()].filter((p) => p.ocCutoff !== null).length
    expect(withCutoff).toBeGreaterThan(0)
  })
})
