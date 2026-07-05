/**
 * @module lib/recommendation/__tests__/golden/validation-scenarios
 *
 * Production-validation scenario matrix (≥200 realistic counseling situations),
 * generated deterministically across cutoff ranges, all communities, major branches,
 * districts, government/private, missing-preference, and edge cases. Each scenario is a
 * {@link RecommendationRequest}; expected OUTCOMES are validated as invariants by the
 * harness (eligibility soundness, in-district, determinism, no-hallucination, ranking
 * consistency, confidence validity) rather than fabricated top-10 lists. Ranking-quality
 * expectations against known counselor outcomes live in the curated `scenarios.ts`.
 */

import { normalizeCommunity, type CommunityCode } from '@/lib/knowledge'
import type { RecommendationRequest } from '@/lib/recommendation'

export interface ValidationScenario {
  readonly id: string
  readonly group: string
  readonly request: RecommendationRequest
}

const cc = (s: string): CommunityCode => normalizeCommunity(s) as CommunityCode
const COMMUNITIES = ['OC', 'BC', 'BCM', 'MBC', 'SC', 'SCA', 'ST'] as const

function build(): ValidationScenario[] {
  const out: ValidationScenario[] = []
  let n = 0
  const add = (group: string, request: RecommendationRequest): void => {
    out.push({ id: `${group}-${String((n += 1)).padStart(3, '0')}`, group, request })
  }
  const byCutoff = (
    studentCutoff: number,
    community: string,
    extra: Partial<RecommendationRequest> = {},
  ): RecommendationRequest => ({
    category: 'by_cutoff',
    studentCutoff,
    community: cc(community),
    limit: 10,
    ...extra,
  })

  // ── High-scoring students: all communities × top cutoffs × 3 districts × CSE ──
  for (const com of COMMUNITIES)
    for (const c of [200, 198, 195])
      for (const d of ['Coimbatore', 'Chennai', 'Madurai'])
        add('high', byCutoff(c, com, { district: d, branch: 'CSE' }))

  // ── Borderline eligibility: all communities × marks around the top cutoffs ──
  for (const com of COMMUNITIES)
    for (const c of [188, 190, 192])
      add('borderline', byCutoff(c, com, { district: 'Coimbatore', branch: 'CSE' }))

  // ── Mid-range: all communities × districts × Mechanical ──
  for (const com of COMMUNITIES)
    for (const c of [175, 180, 185])
      for (const d of ['Salem', 'Madurai'])
        add('mid', byCutoff(c, com, { district: d, branch: 'Mechanical Engineering' }))

  // ── Low cutoff (state-wide, Civil) ──
  for (const com of ['OC', 'BC', 'MBC', 'SC', 'ST'])
    for (const c of [150, 160, 170])
      add('low', byCutoff(c, com, { branch: 'Civil Engineering' }))

  // ── Very low cutoff ──
  for (const com of ['BC', 'MBC', 'SC', 'ST'])
    for (const c of [110, 130])
      add('verylow', byCutoff(c, com))

  // ── Government-college preference ──
  for (const com of ['OC', 'BC', 'MBC', 'SC'])
    for (const c of [185, 190])
      add('government', { category: 'government_college', studentCutoff: c, community: cc(com), limit: 10 })

  // ── Private-college preference ──
  for (const com of ['OC', 'BC', 'MBC'])
    for (const c of [185, 190])
      add('private', { category: 'private_college', studentCutoff: c, community: cc(com), limit: 10 })

  // ── Missing district preference (state-wide) ──
  for (const com of COMMUNITIES)
    for (const c of [190, 180])
      add('no-district', byCutoff(c, com, { branch: 'CSE' }))

  // ── Missing branch preference (district only) ──
  for (const com of COMMUNITIES)
    for (const c of [190, 175])
      add('no-branch', byCutoff(c, com, { district: 'Coimbatore' }))

  // ── Branch-first queries ──
  for (const b of ['CSE', 'ECE', 'Mechanical Engineering', 'Civil Engineering', 'Information Technology'])
    for (const com of ['OC', 'BC'])
      add('by-branch', { category: 'by_branch', branch: b, studentCutoff: 185, community: cc(com), limit: 10 })

  // ── Best-overall (no cutoff constraint) ──
  for (const c of [195, 180, 165])
    add('best-overall', { category: 'best_overall', studentCutoff: c, community: cc('OC'), limit: 10 })

  // ── Edge cases ──
  add('edge', byCutoff(200, 'OC', { district: 'Coimbatore', branch: 'CSE' })) // ceiling
  add('edge', byCutoff(194, 'OC', { district: 'Coimbatore' })) // exact elite tier boundary
  add('edge', byCutoff(184, 'BC', { district: 'Coimbatore' })) // exact strong tier boundary
  add('edge', byCutoff(100, 'ST')) // floor
  add('edge', byCutoff(90, 'SC')) // below floor
  add('edge', byCutoff(190, 'BC', { district: 'Atlantis' })) // unknown district → empty expected
  add('edge', byCutoff(190, 'SCA', { district: 'Coimbatore', branch: 'CSE' })) // rare community
  add('edge', byCutoff(0, 'OC')) // degenerate cutoff
  add('edge', { category: 'best_placement', studentCutoff: 190, community: cc('BC'), limit: 10 })
  add('edge', { category: 'best_roi', studentCutoff: 190, community: cc('BC'), limit: 10 })

  return out
}

export const VALIDATION_SCENARIOS: readonly ValidationScenario[] = build()

/** Groups present, for reporting. */
export const VALIDATION_GROUPS: readonly string[] = [
  ...new Set(VALIDATION_SCENARIOS.map((s) => s.group)),
]
