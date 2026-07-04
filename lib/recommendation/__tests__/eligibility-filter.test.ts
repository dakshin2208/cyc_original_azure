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
import { createRecommendationEngine, createNirf2026CutoffLookup } from '@/lib/recommendation'

const DIR = process.env.CYC_DATA_DIR
const BC = 'BC' as CommunityCode
const OC = 'OC' as CommunityCode

let cached: {
  reco: ReturnType<typeof createRecommendationEngine>
  ocOf: (id: string) => number | null
} | null = null
function setup() {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const cutoffs = createNirf2026CutoffLookup(
      new Map([...wh.nirf2026.byCollege].map(([id, p]) => [id, p.ocCutoff])),
    )
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos), { cutoffs })
    cached = { reco, ocOf: (id) => wh.nirf2026.byCollege.get(id as never)?.ocCutoff ?? null }
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

  it('never surfaces a known OC cutoff far above the student (within reach margin)', () => {
    const { reco, ocOf } = setup()
    const recs = reco.recommendByCutoff(190, BC, { district: 'Coimbatore', limit: 25 })
    for (const r of recs) {
      const oc = ocOf(r.college.id)
      if (oc !== null) expect(oc).toBeLessThanOrEqual(195) // student 190 + reachMargin 5
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
