/**
 * @module lib/opinion/__tests__/context-builder.test
 * Opinion Context Builder (Module 1) — dossiers, strengths/weaknesses, trends,
 * unavailable fees/scholarships, candidate precedence, missing information.
 */

import { describe, expect, it } from 'vitest'
import { SUBSTANTIVE_DIMENSIONS } from '@/lib/opinion'
import { buildOpinionContext, defaultOpinionConfig } from '@/lib/opinion'
import { NAME, orchestrator } from './support'

const deps = { profiles: orchestrator.reco.profiles, config: defaultOpinionConfig }

function build(question: string, strategy: Parameters<typeof buildOpinionContext>[1]['strategy'], priorities: Parameters<typeof buildOpinionContext>[1]['priorities'] = ['overall']) {
  const { parsed, context } = orchestrator.orchestrate(question)
  return buildOpinionContext(deps, {
    parsed: { studentCutoff: parsed.studentCutoff, community: parsed.community, branch: parsed.branch },
    context,
    strategy,
    priorities,
  })
}

describe('buildOpinionContext', () => {
  it('assembles a dossier per candidate with facts from retrieval', () => {
    const oc = build('recommend the best college', 'college_recommendation')
    expect(oc.candidates.length).toBeGreaterThan(0)
    const psg = oc.candidates.find((d) => d.college.name === NAME.psg)
    expect(psg).toBeDefined()
    expect(psg?.placement?.medianSalary).not.toBeNull()
    expect(psg?.faculty).not.toBeNull()
    expect(psg?.evidenceIds.length).toBeGreaterThan(0)
  })

  it('reports fees and scholarships as unavailable (never invented)', () => {
    const oc = build('recommend the best college', 'college_recommendation')
    for (const d of oc.candidates) {
      expect(d.fees).toBeNull()
      expect(d.scholarships).toBeNull()
    }
  })

  it('ranks strengths from substantive dimensions only', () => {
    const oc = build('recommend the best college', 'college_recommendation')
    for (const d of oc.candidates) {
      for (const s of d.strengths) expect(SUBSTANTIVE_DIMENSIONS).toContain(s)
      // A strength is never also listed as a weakness.
      for (const w of d.weaknesses) expect(d.strengths).not.toContain(w)
    }
  })

  it('surfaces the historical salary trend when available', () => {
    const oc = build('recommend the best college', 'college_recommendation')
    const psg = oc.candidates.find((d) => d.college.name === NAME.psg)
    expect((psg?.trend.length ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('uses the compared colleges for a comparison', () => {
    const oc = build(`compare ${NAME.psg} and ${NAME.anna}`, 'comparison')
    expect(oc.comparison).not.toBeNull()
    expect(oc.candidates.map((d) => d.college.name)).toEqual(expect.arrayContaining([NAME.psg, NAME.anna]))
  })

  it('falls back to named subjects when there are no recommendations', () => {
    const oc = build(`tell me about ${NAME.psg}`, 'general_counseling')
    expect(oc.candidates.map((d) => d.college.name)).toContain(NAME.psg)
  })

  it('flags the missing fees dataset for a budget priority', () => {
    const oc = build('recommend a college', 'budget_focused', ['budget'])
    expect(oc.missingInformation.some((m) => m.field === 'fees_dataset')).toBe(true)
  })
})
