/**
 * @module lib/opinion/__tests__/service.test
 *
 * Opinion Service (Module 7) — end-to-end over the fixture warehouse, reusing the
 * Sprint 4 orchestrator + Sprint 5 adapter. Covers the counseling scenarios plus
 * hallucination rejection, missing-evidence, continuity, and determinism.
 */

import { describe, expect, it } from 'vitest'
import { bandedCutoffs, citingProvider, fabricatingProvider, makeOpinion, NAME } from './support'

describe('opinion service — counseling scenarios', () => {
  it('college recommendation → grounded top pick (deterministic without a provider)', async () => {
    const { response } = await makeOpinion().advise('recommend the best college')
    expect(response.strategy).toBe('college_recommendation')
    expect(response.recommendationSummary[0].kind).toBe('top_pick')
    expect(response.usedModel).toBe(false)
    expect(response.answer.length).toBeGreaterThan(0)
  })

  it('comparison → a comparison recommendation with the two colleges', async () => {
    const { response } = await makeOpinion().advise(`Which is better: ${NAME.psg} or ${NAME.anna}?`)
    expect(response.strategy).toBe('comparison')
    expect(response.recommendationSummary[0].kind).toBe('comparison')
    expect(response.recommendationSummary[0].colleges).toEqual(expect.arrayContaining([NAME.psg, NAME.anna]))
  })

  it('branch recommendation → quality with a branch-data caveat', async () => {
    const { response } = await makeOpinion().advise('which college is best for CSE?')
    expect(response.strategy).toBe('branch_recommendation')
    expect(response.answer.toLowerCase()).toMatch(/branch-level data is unavailable/)
  })

  it('eligibility bands → safe / ambitious buckets when cutoffs are wired', async () => {
    const { response } = await makeOpinion({ cutoffs: bandedCutoffs() }).advise(
      'which colleges can I get with 190 cutoff in OC community?',
    )
    expect(response.strategy).toBe('eligibility_bands')
    const kinds = response.recommendationSummary.map((s) => s.kind)
    expect(kinds).toContain('safe')
    expect(kinds).toContain('dream')
  })

  it('missing / unrecognized query → graceful "not enough evidence"', async () => {
    const { response } = await makeOpinion().advise('asdfghjkl qwerty')
    expect(response.strategy).toBe('insufficient_evidence')
    expect(response.answer.toLowerCase()).toMatch(/enough to go on|share your cutoff/)
    expect(response.usedModel).toBe(false)
  })
})

describe('opinion service — model integration', () => {
  it('uses a grounded model answer when the provider cites real evidence', async () => {
    const { response } = await makeOpinion({ provider: citingProvider() }).advise('recommend the best college')
    expect(response.usedModel).toBe(true)
    expect(response.evidence.length).toBeGreaterThan(0)
  })

  it('rejects a hallucinating provider and returns the deterministic grounded answer', async () => {
    const { response } = await makeOpinion({ provider: fabricatingProvider() }).advise('recommend the best college')
    expect(response.usedModel).toBe(false)
    expect(response.answer).not.toMatch(/Fantastic Institute/i)
    expect(response.recommendationSummary[0].kind).toBe('top_pick')
  })
})

describe('opinion service — continuity & determinism', () => {
  it('threads conversation state across turns', async () => {
    const svc = makeOpinion()
    const first = await svc.advise('recommend a college')
    expect(first.state.turnCount).toBe(1)
    const second = await svc.advise(`compare ${NAME.psg} and ${NAME.anna}`, { priorState: first.state })
    expect(second.state.turnCount).toBe(2)
    expect(second.state.mentionedColleges.length).toBeGreaterThanOrEqual(2)
  })

  it('is deterministic for identical inputs', async () => {
    const a = await makeOpinion().advise('recommend the best college')
    const b = await makeOpinion().advise('recommend the best college')
    expect(a.response.answer).toBe(b.response.answer)
    expect(a.response.recommendationSummary).toEqual(b.response.recommendationSummary)
  })
})
