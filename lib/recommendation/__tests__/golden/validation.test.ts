/**
 * @module lib/recommendation/__tests__/golden/validation.test
 *
 * Production validation (Phases 2–3). Runs the engine over the ≥200-scenario matrix and
 * measures INVARIANTS that must hold for a trustworthy counselor — eligibility
 * soundness, in-district correctness, determinism, no-hallucination, ranking
 * consistency, confidence validity — plus a coverage/confidence census. Hard-correctness
 * invariants are gated at 100%; eligibility/district are gated high and any shortfall is
 * a reported finding (never silently tuned away). Gated on the real warehouse.
 */

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CommunityCode, type KnowledgeRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup, createRecommendationEngine, type RecommendationEngine } from '@/lib/recommendation'
import { VALIDATION_GROUPS, VALIDATION_SCENARIOS, type ValidationScenario } from './validation-scenarios'

const REACH_MARGIN = 5 // config.eligibility.reachMargin — surfaced ⇒ margin ≥ −REACH_MARGIN

interface Checks {
  readonly deterministic: boolean
  readonly noHallucination: boolean
  readonly inDistrict: boolean
  readonly eligibilitySound: boolean
  readonly contiguous: boolean
  readonly confidenceValid: boolean
}
interface Outcome {
  readonly scenario: ValidationScenario
  readonly count: number
  readonly confidence: string | null
  readonly checks: Checks
  readonly failures: readonly string[]
}

const names = (rs: readonly { college: { name: string } }[]): string[] => rs.map((r) => r.college.name)

function evaluate(reco: RecommendationEngine, repos: KnowledgeRepositories, s: ValidationScenario): Outcome {
  const recs = reco.recommend(s.request)
  const recs2 = reco.recommend(s.request)
  const req = s.request
  const districtWanted = req.district?.trim().toLowerCase()
  const hasElig = req.studentCutoff !== undefined && req.community !== undefined

  const effCutoff = (id: string): number | null =>
    (req.community !== undefined
      ? repos.colleges.communityCutoffOf(id as never, req.community as CommunityCode)
      : null) ?? repos.colleges.ocCutoffOf(id as never)

  const checks: Checks = {
    deterministic: JSON.stringify(names(recs)) === JSON.stringify(names(recs2)),
    noHallucination: recs.every((r) => repos.colleges.getById(r.college.id) !== null),
    inDistrict:
      !districtWanted ||
      recs.every((r) => (repos.colleges.districtOf(r.college.id) ?? '').toLowerCase() === districtWanted),
    eligibilitySound:
      !hasElig ||
      recs.every((r) => {
        const cut = effCutoff(r.college.id)
        return cut === null || cut <= (req.studentCutoff as number) + REACH_MARGIN
      }),
    contiguous:
      recs.every((r, i) => r.rank === i + 1) &&
      recs.every((r, i) => i === 0 || r.score.total <= recs[i - 1].score.total + 1e-9),
    confidenceValid: recs.every((r) => ['low', 'medium', 'high'].includes(r.confidence.level)),
  }
  const failures = (Object.keys(checks) as (keyof Checks)[]).filter((k) => !checks[k])
  return { scenario: s, count: recs.length, confidence: recs[0]?.confidence.level ?? null, checks, failures }
}

function rate(outcomes: readonly Outcome[], k: keyof Checks): number {
  return outcomes.filter((o) => o.checks[k]).length / outcomes.length
}

const DIR = process.env.CYC_DATA_DIR
let cached: { reco: RecommendationEngine; repos: KnowledgeRepositories } | null = null
function setup() {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos), {
      cutoffs: createCommunityCutoffLookup(repos),
    })
    cached = { reco, repos }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR as string))('production validation — golden dataset (≥200 scenarios)', () => {
  it('has at least 200 scenarios across all groups', () => {
    expect(VALIDATION_SCENARIOS.length).toBeGreaterThanOrEqual(200)
  })

  it('meets invariant thresholds and prints the validation report', () => {
    const { reco, repos } = setup()
    const outcomes = VALIDATION_SCENARIOS.map((s) => evaluate(reco, repos, s))

    const rates = {
      deterministic: rate(outcomes, 'deterministic'),
      noHallucination: rate(outcomes, 'noHallucination'),
      contiguous: rate(outcomes, 'contiguous'),
      confidenceValid: rate(outcomes, 'confidenceValid'),
      eligibilitySound: rate(outcomes, 'eligibilitySound'),
      inDistrict: rate(outcomes, 'inDistrict'),
    }
    const empties = outcomes.filter((o) => o.count === 0)
    const confDist = outcomes.reduce<Record<string, number>>((a, o) => {
      const k = o.confidence ?? 'none'
      a[k] = (a[k] ?? 0) + 1
      return a
    }, {})
    const byGroup = VALIDATION_GROUPS.map((g) => {
      const gs = outcomes.filter((o) => o.scenario.group === g)
      const passed = gs.filter((o) => o.failures.length === 0).length
      return `  ${g.padEnd(13)} ${passed}/${gs.length}`
    })
    const fails = outcomes.filter((o) => o.failures.length > 0)

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`
    const lines = [
      '',
      '════════ PRODUCTION VALIDATION REPORT ════════',
      `Scenarios: ${outcomes.length}  |  fully-passing: ${outcomes.length - fails.length}  |  with-findings: ${fails.length}`,
      `Empty result sets: ${empties.length} (ids: ${empties.map((e) => e.scenario.id).slice(0, 8).join(', ')}${empties.length > 8 ? '…' : ''})`,
      '── Invariant pass rates ──',
      `  determinism        ${pct(rates.deterministic)}`,
      `  no-hallucination   ${pct(rates.noHallucination)}`,
      `  ranking-contiguity ${pct(rates.contiguous)}`,
      `  confidence-valid   ${pct(rates.confidenceValid)}`,
      `  eligibility-sound  ${pct(rates.eligibilitySound)}`,
      `  in-district        ${pct(rates.inDistrict)}`,
      '── Per-group fully-passing ──',
      ...byGroup,
      `── Confidence distribution ── ${JSON.stringify(confDist)}`,
      fails.length > 0 ? `── Findings (first 12) ──` : '── No findings ──',
      ...fails.slice(0, 12).map((o) => `  ${o.scenario.id} [${o.scenario.group}] → ${o.failures.join(', ')}`),
      '══════════════════════════════════════════════',
      '',
    ]
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))

    // Hard-correctness invariants MUST hold for every scenario.
    expect(rates.deterministic).toBe(1)
    expect(rates.noHallucination).toBe(1)
    expect(rates.contiguous).toBe(1)
    expect(rates.confidenceValid).toBe(1)
    // Eligibility soundness is a correctness guarantee of the filter.
    expect(rates.eligibilitySound).toBe(1)
    // In-district: gated high; any shortfall is a reported residual-leak finding.
    expect(rates.inDistrict).toBeGreaterThanOrEqual(0.95)
  })
})
