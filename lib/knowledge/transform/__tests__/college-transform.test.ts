/**
 * College transform tests — lock in the identity/merge rules that keep distinct
 * colleges from collapsing when the source shares/conflicts nirf_ids.
 */

import { describe, expect, it } from 'vitest'
import type { CsvRow } from '@/lib/knowledge'
import { transformColleges } from '@/lib/knowledge/transform/college-transform'

const row = (r: Record<string, string>): CsvRow => r
const nirfs = (items: readonly { nirfId: unknown }[]) =>
  items.map((c) => c.nirfId as string | null).sort()

describe('transformColleges — identity & merge', () => {
  it('preserves distinct-named colleges that share a nirf_id', () => {
    const { items } = transformColleges(
      [
        row({ name: 'Alpha College', city: 'X', state: 'TN', nirf_id: 'IR-1', have_nirf_data: 'YES' }),
        row({ name: 'Beta College', city: 'Y', state: 'TN', nirf_id: 'IR-1', have_nirf_data: 'YES' }),
      ],
      [],
    )
    expect(items).toHaveLength(2) // NOT collapsed by the shared nirf
    expect(items.filter((c) => (c.nirfId as string) === 'IR-1')).toHaveLength(2)
  })

  it("binds the institution's nirf to the college it names — the master's nirf_id is not authoritative", () => {
    // institutions.csv is the authoritative name↔NIRF-code source; the master's nirf_id is
    // unreliable (it assigned Arifa's code to Coimbatore Institute of Technology). When the
    // name identifies exactly ONE college, the institution's code binds to THAT college —
    // it must NOT spawn a second, factless ghost record for the same college.
    const { items } = transformColleges(
      [row({ name: 'Gamma College', city: 'X', state: 'TN', nirf_id: 'IR-2', have_nirf_data: 'YES' })],
      [row({ nirf_id: 'IR-3', institution_name: 'Gamma College' })],
    )
    expect(items).toHaveLength(1) // ONE college, not a split
    expect(nirfs(items)).toEqual(['IR-3']) // the authoritative code wins
  })

  it('preserves same-name colleges in DIFFERENT cities (never over-merges)', () => {
    // Four real Government Colleges of Engineering share one (wrong) master nirf_id. Identity
    // is name + city, so they must remain four distinct colleges.
    const { items } = transformColleges(
      [
        row({ name: 'Government College of Engineering', city: 'Salem', state: 'TN', nirf_id: 'IR-9', have_nirf_data: 'YES' }),
        row({ name: 'Government College of Engineering', city: 'Theni', state: 'TN', nirf_id: 'IR-9', have_nirf_data: 'YES' }),
      ],
      [],
    )
    expect(items).toHaveLength(2)
    expect(items.map((c) => c.city).sort()).toEqual(['Salem', 'Theni'])
  })

  it('backfills the nirf linkage when a master college has none', () => {
    const { items } = transformColleges(
      [row({ name: 'Delta College', city: 'X', state: 'TN', nirf_id: '', have_nirf_data: 'NO' })],
      [row({ nirf_id: 'IR-4', institution_name: 'Delta College' })],
    )
    expect(items).toHaveLength(1) // merged by name
    expect(items[0].nirfId as string).toBe('IR-4') // linkage backfilled
    expect(items[0].hasNirfData).toBe(true)
  })

  it('skips rows missing required fields', () => {
    const { items, issues } = transformColleges(
      [row({ name: '' }), row({ name: 'Valid College', nirf_id: 'IR-5' })],
      [],
    )
    expect(items).toHaveLength(1)
    expect(issues.some((i) => i.kind === 'missing_field')).toBe(true)
  })
})
