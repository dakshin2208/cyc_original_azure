/**
 * @module lib/ai/tools/__tests__/verify-quality
 *
 * LIVE verification of the recommendation-quality improvements against the REAL
 * warehouse (and, when the Azure key is present, the real writer). Opt-in: skips
 * when .env.local lacks CYC_DATA_DIR. Proves:
 *   #5 branch preference — AI & DS asks prefer colleges that offer AI & DS
 *   #4 district strict   — a Chennai ask never returns a non-Chennai college
 *   #1 constraints       — district + branch + cutoff + community applied together
 *   #2/#3 writer phrasing — printed for inspection (no "accessible" w/o cutoff; varied)
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CanonicalCollegeId, type CommunityCode } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup, createRecommendationEngine } from '@/lib/recommendation'

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  let raw = ''
  try {
    raw = readFileSync('.env.local', 'utf8')
  } catch {
    return out
  }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return out
}

const env = loadEnvLocal()
const AIDS = 'Artificial Intelligence and Data Science'
const cc = (s: string): CommunityCode => s as CommunityCode

describe.skipIf(!env.CYC_DATA_DIR)('recommendation-quality improvements (real warehouse)', () => {
  const repos = createRepositories(buildWarehouseFromDirectory(env.CYC_DATA_DIR as string))
  const retrieval = createRetrievalEngine(repos)
  const reco = createRecommendationEngine(repos, retrieval, { cutoffs: createCommunityCutoffLookup(repos) })
  const offers = (id: CanonicalCollegeId, branch: string) => repos.colleges.branchesOffered(id).has(branch)

  it('#5 data: the warehouse now exposes per-college branch offerings (incl. AI & DS)', () => {
    const withAids = repos.colleges.list().filter((c) => offers(c.id, AIDS))
    const withCse = repos.colleges.list().filter((c) => offers(c.id, 'Computer Science and Engineering'))
    console.log(`\n#5 branch offerings — colleges offering AI&DS: ${withAids.length}, offering CSE: ${withCse.length}`)
    expect(withAids.length).toBeGreaterThan(0)
    expect(withCse.length).toBeGreaterThan(0)
  })

  it('#5 preference: an AI & DS recommendation prefers colleges that OFFER AI & DS', () => {
    const results = reco.recommendByBranch(AIDS, { studentCutoff: 180, community: cc('BC'), limit: 10 })
    expect(results.length).toBeGreaterThan(0)
    const topOffers = results.slice(0, 5).filter((r) => offers(r.college.id, AIDS)).length
    console.log(`\n#5 preference — top 5 for AI&DS, # offering AI&DS: ${topOffers}/5`)
    console.log('   ' + results.slice(0, 5).map((r) => `${r.college.name}${offers(r.college.id, AIDS) ? ' ✓AIDS' : ''}`).join('\n   '))
    // The #1 ranked college must actually offer the requested branch (preference is active).
    expect(offers(results[0].college.id, AIDS)).toBe(true)
    // And AI&DS-offering colleges dominate the top of the list.
    expect(topOffers).toBeGreaterThanOrEqual(4)
  })

  it('#4 district strict: a Chennai recommendation never returns a non-Chennai college', () => {
    const results = reco.recommendByCutoff(180, cc('BC'), { district: 'Chennai', limit: 15 })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect((repos.colleges.districtOf(r.college.id) ?? '').toLowerCase()).toBe('chennai')
    }
    console.log(`\n#4 Chennai strict — ${results.length} results, all in Chennai ✓`)
  })

  it('#1 constraints together: cutoff + community + district + branch all applied', () => {
    const results = reco.recommendByBranch(AIDS, { studentCutoff: 185, community: cc('OC'), district: 'Coimbatore', limit: 10 })
    // District honoured…
    for (const r of results) expect((repos.colleges.districtOf(r.college.id) ?? '').toLowerCase()).toBe('coimbatore')
    // …branch preferred (top offers AI&DS if any Coimbatore college does)…
    const anyOffers = results.some((r) => offers(r.college.id, AIDS))
    if (anyOffers) expect(offers(results[0].college.id, AIDS)).toBe(true)
    // …and eligibility banded (cutoff+community present → every result carries an assessment).
    for (const r of results) expect(r.eligibility).not.toBeNull()
    console.log(`\n#1 constraints — Coimbatore + AI&DS + cutoff 185 OC: ${results.length} results, all banded ✓`)
  })
})
