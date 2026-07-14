/**
 * @module lib/knowledge/__tests__/catalog-dedup
 *
 * Guards the canonical-college identity model against the two opposite defects found in the
 * catalog:
 *
 *  (1) SPLIT — "Coimbatore Institute of Technology" existed TWICE: the master row carried
 *      another college's NIRF code (IR-E-C-49138 = Arifa), so the real, data-bearing CIT
 *      (IR-E-C-36969) was registered as a second record. A query could resolve to the empty
 *      ghost and show a blank card for a top-3 college.
 *
 *  (2) FUSED — the four Government Colleges of Engineering (Krishnagiri / Tirunelveli /
 *      Salem / Theni) all carry ONE (wrong) master NIRF code and, under a name-only key,
 *      collapsed into a single record: three real colleges silently lost.
 *
 * Identity is therefore (normalized name + city), and the NIRF code comes from
 * institutions.csv (the authoritative name↔code source), never the master. Runs over the
 * SHIPPED `data/`.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('canonical college catalog — identity & dedup', () => {
  const warehouse = buildWarehouseFromDirectory(DATA_DIR)
  const repos = createRepositories(warehouse)
  const colleges = warehouse.colleges

  it('has NO same-college duplicates (same normalized name AND same city)', () => {
    const groups = new Map<string, string[]>()
    for (const c of colleges) {
      const key = `${c.name.trim().toLowerCase()}|${(c.city ?? '').trim().toLowerCase()}`
      groups.set(key, [...(groups.get(key) ?? []), c.id])
    }
    const dups = [...groups.entries()].filter(([, ids]) => ids.length > 1)
    expect(dups, `duplicate college records: ${JSON.stringify(dups)}`).toHaveLength(0)
  })

  it('college ids are unique', () => {
    expect(new Set(colleges.map((c) => c.id)).size).toBe(colleges.length)
  })

  it('CIT resolves to ONE record that carries the data (Power Score 94.36, rank #3)', () => {
    const cit = colleges.filter((c) => /^coimbatore institute of technology$/i.test(c.name.trim()))
    expect(cit).toHaveLength(1) // no empty twin
    const [c] = cit
    expect(c.nirfId).toBe('IR-E-C-36969') // the authoritative code, not the master's (Arifa's)
    expect(repos.colleges.powerScoreOf(c.id)).toBeCloseTo(94.36, 2)
    expect(repos.colleges.powerScoreRankOf(c.id)).toBe(3)
    expect(repos.placements.byCollege(c.id).length).toBeGreaterThan(0) // the data-bearing join survived
  })

  it('Arifa keeps its OWN NIRF code and data (it was never merged away)', () => {
    const arifa = colleges.find((c) => /arifa/i.test(c.name))!
    expect(arifa.nirfId).toBe('IR-E-C-49138')
    expect(repos.placements.byCollege(arifa.id).length).toBeGreaterThan(0)
  })

  it('the four DISTINCT Government Colleges of Engineering are PRESERVED, not merged', () => {
    const gce = colleges.filter((c) => /^government college of engineering$/i.test(c.name.trim()))
    const cities = gce.map((c) => (c.city ?? '').toLowerCase()).sort()
    expect(cities).toEqual(['krishnagiri', 'salem', 'theni', 'tirunelveli'])
    // Each is its own record — same name, different district ⇒ different college.
    expect(new Set(gce.map((c) => c.id)).size).toBe(4)
  })
})
