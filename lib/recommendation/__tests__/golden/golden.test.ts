/**
 * @module lib/recommendation/__tests__/golden/golden.test
 *
 * Milestone M1 — the golden regression harness. Two tiers:
 *   • Synthetic invariants (hermetic, always on) — lock correct behavior over the
 *     `makeHarness()` fixture; run in CI with no data directory.
 *   • Real-warehouse scenarios (gated on `CYC_DATA_DIR`) — `lock` + `target` counseling
 *     outcomes over the production data.
 *
 * `target` rows run via `it.fails`: they encode the counselor-correct result we are
 * building toward and are EXPECTED TO FAIL against today's engine. When a milestone
 * makes one pass, `it.fails` turns red — the signal to promote it to `lock`. This file
 * asserts the engine; it never changes it (behavior-neutral by construction).
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import {
  createCommunityCutoffLookup,
  createRecommendationEngine,
  type RecommendationEngine,
} from '@/lib/recommendation'
import { makeHarness, NAME } from '../support'
import { FLAGSHIP_REQUEST, REAL_DATA_SCENARIOS, type GoldenExpect } from './scenarios'

const namesOf = (rs: readonly { readonly college: { readonly name: string } }[]): string[] =>
  rs.map((r) => r.college.name)

function checkExpect(ns: readonly string[], e: GoldenExpect): void {
  if (e.minResults !== undefined) expect(ns.length).toBeGreaterThanOrEqual(e.minResults)
  if (e.top1 !== undefined) expect(ns[0]).toBe(e.top1)
  if (e.top1Not !== undefined) expect(ns[0]).not.toBe(e.top1Not)
  if (e.top3) for (const n of e.top3) expect(ns.slice(0, 3)).toContain(n)
  if (e.contains) for (const n of e.contains) expect(ns).toContain(n)
  if (e.excludes) for (const n of e.excludes) expect(ns).not.toContain(n)
  if (e.before)
    for (const [a, b] of e.before) {
      const ia = ns.indexOf(a)
      const ib = ns.indexOf(b)
      expect(ia, `${a} must be present`).toBeGreaterThanOrEqual(0)
      if (ib >= 0) expect(ia).toBeLessThan(ib)
    }
}

// Contiguous ranks from 1, non-increasing total — the universal well-formedness invariant.
function assertWellFormed(rs: readonly { readonly rank: number; readonly score: { readonly total: number } }[]): void {
  rs.forEach((r, i) => expect(r.rank).toBe(i + 1))
  for (let i = 1; i < rs.length; i += 1) {
    expect(rs[i].score.total).toBeLessThanOrEqual(rs[i - 1].score.total)
  }
}

// ── Tier 1: synthetic invariants (hermetic; no CYC_DATA_DIR needed) ────────────
describe('golden — synthetic invariants', () => {
  const { reco, repos } = makeHarness()

  it('ranks the strongest college first (best overall)', () => {
    expect(namesOf(reco.recommendBestCollege())[0]).toBe(NAME.alpha)
  })
  it('is deterministic (identical runs are byte-identical)', () => {
    expect(namesOf(reco.recommendBestCollege())).toEqual(namesOf(reco.recommendBestCollege()))
  })
  it('produces well-formed rankings (contiguous ranks, non-increasing score)', () => {
    assertWellFormed(reco.recommendBestCollege())
  })
  it('partitions government and private across every college', () => {
    const all = repos.colleges.list().length
    const gov = reco.recommendGovernmentColleges({ limit: all }).length
    const pri = reco.recommendPrivateColleges({ limit: all }).length
    expect(gov + pri).toBe(all)
  })
})

// ── Tier 2: real warehouse (gated) ────────────────────────────────────────────
const DIR = process.env.CYC_DATA_DIR
let cached: RecommendationEngine | null = null
function realReco(): RecommendationEngine {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const retrieval = createRetrievalEngine(repos)
    const cutoffs = createCommunityCutoffLookup(repos)
    cached = createRecommendationEngine(repos, retrieval, { cutoffs })
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR as string))('golden — real warehouse', () => {
  it('flagship ranking is deterministic', () => {
    expect(namesOf(realReco().recommend(FLAGSHIP_REQUEST))).toEqual(
      namesOf(realReco().recommend(FLAGSHIP_REQUEST)),
    )
  })
  it('flagship ranking is well-formed', () => {
    assertWellFormed(realReco().recommend(FLAGSHIP_REQUEST))
  })

  for (const s of REAL_DATA_SCENARIOS) {
    const runner = s.mode === 'target' ? it.fails : it
    runner(`[${s.mode}] ${s.id} — ${s.note ?? ''}`, () => {
      checkExpect(namesOf(realReco().recommend(s.request)), s.expect)
    })
  }

  it('baseline report (non-gating)', () => {
    const top5 = namesOf(realReco().recommend(FLAGSHIP_REQUEST)).slice(0, 5)
    // eslint-disable-next-line no-console
    console.log('GOLDEN BASELINE — flagship top-5 (BC/190/CSE/Coimbatore):', JSON.stringify(top5))
  })
})
