/**
 * @module lib/recommendation/__tests__/eligibility-filter.test
 *
 * Phase 3 (RC4) — the engine filters out clearly-ineligible ("dream") colleges
 * BEFORE ranking, using the 2026 OC closing cutoffs. Gated on the real warehouse.
 * Unknown cutoffs are kept (no fabricated ineligibility); the explicit band
 * strategies (dream/reach/…) are exempt so they still return their band.
 */

import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CommunityCode } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createRecommendationEngine, createNirf2026CutoffLookup } from '@/lib/recommendation'

const DIR = process.env.CYC_DATA_DIR

describe.skipIf(!DIR)('recommendation — eligibility filter (Phase 3)', () => {
  const wh = buildWarehouseFromDirectory(DIR as string)
  const repos = createRepositories(wh)
  const cutoffs = createNirf2026CutoffLookup(
    new Map([...wh.nirf2026.byCollege].map(([id, p]) => [id, p.ocCutoff])),
  )
  const reco = createRecommendationEngine(repos, createRetrievalEngine(repos), { cutoffs })
  const ocOf = (id: string) => wh.nirf2026.byCollege.get(id as never)?.ocCutoff ?? null
  const BC = 'BC' as CommunityCode
  const OC = 'OC' as CommunityCode

  it('excludes clearly-ineligible (dream) colleges from the flagship query', () => {
    const recs = reco.recommendByCutoff(190, BC, { district: 'Coimbatore', limit: 25 })
    expect(recs.length).toBeGreaterThan(0)
    for (const r of recs) expect(r.eligibility?.category).not.toBe('dream')
  })

  it('never surfaces a known OC cutoff far above the student (within reach margin)', () => {
    const recs = reco.recommendByCutoff(190, BC, { district: 'Coimbatore', limit: 25 })
    for (const r of recs) {
      const oc = ocOf(r.college.id)
      if (oc !== null) expect(oc).toBeLessThanOrEqual(195) // student 190 + reachMargin 5
    }
  })

  it('keeps colleges with UNKNOWN cutoff (no fabricated ineligibility)', () => {
    expect(reco.recommendByCutoff(190, OC, { limit: 50 }).length).toBeGreaterThan(0)
  })

  it('band strategies are exempt — recommendDreamColleges still returns the dream band', () => {
    const dreams = reco.recommendDreamColleges(120, OC, { limit: 10 })
    expect(dreams.length).toBeGreaterThan(0)
    for (const r of dreams) expect(r.eligibility?.category).toBe('dream')
  })
})
