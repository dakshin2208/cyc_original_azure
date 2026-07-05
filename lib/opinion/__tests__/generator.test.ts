/**
 * @module lib/opinion/__tests__/generator.test
 * Opinion Generator (Module 3) — banding, quality, insufficient, trade-offs/risks.
 */

import { describe, expect, it } from 'vitest'
import type { CanonicalCollege } from '@/lib/knowledge'
import type { EligibilityCategory, ScoreDimension } from '@/lib/recommendation'
import type { ConfidenceLevel, EvidencePackage } from '@/lib/ai/orchestration'
import {
  defaultOpinionConfig,
  generateOpinions,
  type CollegeDossier,
  type OpinionContext,
  type OpinionStrategy,
} from '@/lib/opinion'

const college = (name: string): CanonicalCollege =>
  ({ id: `col:${name}`, name, nameSlug: name.toLowerCase(), city: null, state: null, nirfId: null, counsellingCodes: [], hasNirfData: true }) as unknown as CanonicalCollege

const EMPTY_EVIDENCE: EvidencePackage = { items: [], count: 0, bySource: { recommendation: 0, comparison: 0, retrieval: 0, warehouse: 0 } }

function dossier(
  name: string,
  o: {
    eligibility?: EligibilityCategory
    strengths?: ScoreDimension[]
    weaknesses?: ScoreDimension[]
    confidence?: ConfidenceLevel
  } = {},
): CollegeDossier {
  return {
    college: college(name),
    instituteType: 'private',
    placement: null,
    faculty: null,
    research: null,
    finance: null,
    fees: null,
    scholarships: null,
    location: null,
    strengths: o.strengths ?? ['placement'],
    weaknesses: o.weaknesses ?? ['research'],
    trend: [],
    eligibility: o.eligibility
      ? { category: o.eligibility, studentCutoff: 180, closingCutoff: 175, margin: 5, hasData: true, basis: 'x' }
      : null,
    overallScore: 0.7,
    confidence: o.confidence ?? 'high',
    evidenceIds: [`ev:${name}`],
  }
}

const ctx = (strategy: OpinionStrategy, candidates: CollegeDossier[], priorities: OpinionContext['priorities'] = ['overall']): OpinionContext => ({
  strategy,
  priorities,
  studentCutoff: null,
  community: null,
  branch: null,
  candidates,
  comparison: null,
  evidence: EMPTY_EVIDENCE,
  missingInformation: [],
})

describe('generateOpinions', () => {
  it('buckets eligibility into safe / moderate / dream', () => {
    const context = ctx('eligibility_bands', [
      dossier('SafeCollege', { eligibility: 'safe' }),
      dossier('TargetCollege', { eligibility: 'target' }),
      dossier('ReachCollege', { eligibility: 'reach' }),
    ])
    const result = generateOpinions(context, defaultOpinionConfig)
    const kinds = result.recommendations.map((r) => r.kind)
    expect(kinds).toContain('safe')
    expect(kinds).toContain('moderate')
    expect(kinds).toContain('dream')
    expect(result.recommendations.find((r) => r.kind === 'safe')?.colleges).toEqual(['SafeCollege'])
  })

  it('falls back to quality + an eligibility caveat when cutoffs are unknown', () => {
    const result = generateOpinions(ctx('eligibility_bands', [dossier('A'), dossier('B')]), defaultOpinionConfig)
    expect(result.recommendations[0].kind).toBe('top_pick')
    expect(result.recommendations.flatMap((r) => r.risks).join(' ')).toMatch(/eligibility/i)
  })

  it('emits a single insufficient recommendation when there are no candidates', () => {
    const result = generateOpinions(ctx('college_recommendation', []), defaultOpinionConfig)
    expect(result.strategy).toBe('insufficient_evidence')
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].kind).toBe('insufficient')
  })

  it('produces a top pick + alternatives with trade-offs, risks, and evidence ids', () => {
    const result = generateOpinions(
      ctx('college_recommendation', [dossier('Top'), dossier('Alt1'), dossier('Alt2')]),
      defaultOpinionConfig,
    )
    const kinds = result.recommendations.map((r) => r.kind)
    expect(kinds).toEqual(['top_pick', 'alternative'])
    const top = result.recommendations[0]
    expect(top.tradeoffs.join(' ')).toMatch(/weaker research/i)
    expect(top.risks.join(' ')).toMatch(/eligibility is unconfirmed/i)
    expect(result.evidenceIds).toContain('ev:Top')
  })

  it('adds a fees-unavailable risk for a budget priority', () => {
    const result = generateOpinions(ctx('budget_focused', [dossier('X')], ['budget']), defaultOpinionConfig)
    expect(result.recommendations.flatMap((r) => r.risks).join(' ')).toMatch(/fees are not available/i)
  })
})
