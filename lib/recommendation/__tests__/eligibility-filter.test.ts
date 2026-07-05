/**
 * @module lib/recommendation/__tests__/eligibility-filter.test
 *
 * Phase 3 (RC4) — the engine filters out clearly-ineligible ("dream") colleges
 * BEFORE ranking, using the 2026 OC closing cutoffs. Gated on the real warehouse.
 * Unknown cutoffs are kept (no fabricated ineligibility); the explicit band
 * strategies (dream/reach/…) are exempt so they still return their band.
 *
 * The warehouse is built LAZILY inside a memoized `setup()` so the suite skips
 * cleanly — without throwing during collection — when `CYC_DATA_DIR` is unset.
 */

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CommunityCode } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createRecommendationEngine, createCommunityCutoffLookup } from '@/lib/recommendation'

const DIR = process.env.CYC_DATA_DIR
const BC = 'BC' as CommunityCode
const OC = 'OC' as CommunityCode

let cached: {
  reco: ReturnType<typeof createRecommendationEngine>
  /** Effective BC closing cutoff used for banding: community median, else OC. */
  bcCutoffOf: (id: string) => number | null
} | null = null
function setup() {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const cutoffs = createCommunityCutoffLookup(repos)
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos), { cutoffs })
    cached = {
      reco,
      bcCutoffOf: (id) =>
        repos.colleges.communityCutoffOf(id as never, BC) ?? repos.colleges.ocCutoffOf(id as never),
    }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR as string))('recommendation — eligibility filter (Phase 3)', () => {
  it('excludes clearly-ineligible (dream) colleges from the flagship query', () => {
    const { reco } = setup()
    const recs = reco.recommendByCutoff(190, BC, { district: 'Coimbatore', limit: 25 })
    expect(recs.length).toBeGreaterThan(0)
    for (const r of recs) expect(r.eligibility?.category).not.toBe('dream')
  })

  it('never surfaces a college whose BC cutoff is far above the student (within reach margin)', () => {
    const { reco, bcCutoffOf } = setup()
    const recs = reco.recommendByCutoff(190, BC, { district: 'Coimbatore', limit: 25 })
    for (const r of recs) {
      const bc = bcCutoffOf(r.college.id)
      if (bc !== null) expect(bc).toBeLessThanOrEqual(195) // student 190 + reachMargin 5, on BC marks
    }
  })

  it('keeps colleges with UNKNOWN cutoff (no fabricated ineligibility)', () => {
    const { reco } = setup()
    expect(reco.recommendByCutoff(190, OC, { limit: 50 }).length).toBeGreaterThan(0)
  })

  it('band strategies are exempt — recommendDreamColleges still returns the dream band', () => {
    const { reco } = setup()
    const dreams = reco.recommendDreamColleges(120, OC, { limit: 10 })
    expect(dreams.length).toBeGreaterThan(0)
    for (const r of dreams) expect(r.eligibility?.category).toBe('dream')
  })
})
