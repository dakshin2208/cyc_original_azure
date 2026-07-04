/**
 * @module lib/recommendation/__tests__/district-filter.test
 *
 * Phase 2 (RC2/RC3) — the recommendation engine must never surface a college
 * outside the requested district. Gated on the real warehouse (the district data
 * comes from the 2026 enrichment dataset). Filtering happens BEFORE ranking.
 *
 * The warehouse is built LAZILY inside a memoized `setup()` (not in the describe
 * body) so the suite skips cleanly — without throwing during collection — when
 * `CYC_DATA_DIR` is unset (e.g. in CI).
 */

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CommunityCode } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createRecommendationEngine } from '@/lib/recommendation'

const DIR = process.env.CYC_DATA_DIR

let cached: {
  reco: ReturnType<typeof createRecommendationEngine>
  districtOf: (id: string) => string
} | null = null
function setup() {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos))
    cached = { reco, districtOf: (id) => (repos.colleges.districtOf(id as never) ?? '').toLowerCase() }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR as string))('recommendation — district filter (Phase 2)', () => {
  it('recommendBestCollege(district) returns ONLY that district', () => {
    const { reco, districtOf } = setup()
    const recs = reco.recommendBestCollege({ district: 'Coimbatore', limit: 25 })
    expect(recs.length).toBeGreaterThan(0)
    for (const r of recs) expect(districtOf(r.college.id)).toBe('coimbatore')
  })

  it('recommendByCutoff(district) stays in-district', () => {
    const { reco, districtOf } = setup()
    const recs = reco.recommendByCutoff(190, 'BC' as CommunityCode, { district: 'Chennai', limit: 25 })
    expect(recs.length).toBeGreaterThan(0)
    for (const r of recs) expect(districtOf(r.college.id)).toBe('chennai')
  })

  it('is case-insensitive', () => {
    const { reco, districtOf } = setup()
    const recs = reco.recommendBestCollege({ district: 'sALeM', limit: 15 })
    for (const r of recs) expect(districtOf(r.college.id)).toBe('salem')
  })

  it('without a district, results span multiple districts (unfiltered)', () => {
    const { reco, districtOf } = setup()
    const recs = reco.recommendBestCollege({ limit: 25 })
    const districts = new Set(recs.map((r) => districtOf(r.college.id)))
    expect(districts.size).toBeGreaterThan(1)
  })

  it('an unknown district yields no candidates (never leaks out-of-district)', () => {
    const { reco } = setup()
    expect(reco.recommendBestCollege({ district: 'Atlantis', limit: 10 })).toHaveLength(0)
  })
})
