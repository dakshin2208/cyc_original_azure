/**
 * @module lib/ai/chat/__tests__/planner.test
 *
 * The LLM planner owns UNDERSTANDING. These tests pin the two properties that make it safe to
 * put an LLM in the routing path at all:
 *   1. It emits WORDS + a closed-enum action — never a fact — and every field is re-resolved by
 *      the existing deterministic resolvers (so a name it invents that resolves to nothing is
 *      dropped by the same phantom-college guard).
 *   2. A malformed / unreachable / low-value plan degrades to the deterministic classifier — it
 *      can improve a turn, never break one.
 */

import { describe, expect, it } from 'vitest'
import { createFunctionProvider, createUnavailableProvider } from '@/lib/ai/llm'
import {
  createCounselorPlanner,
  expandCollegeWord,
  parsePlan,
  translatePlan,
  type CounselorPlan,
} from '@/lib/ai/chat'

const plan = (over: Partial<CounselorPlan>): CounselorPlan => ({
  action: 'recommend',
  colleges: [],
  city: null,
  branch: null,
  metric: null,
  limit: null,
  confidence: 'high',
  reasoning: '',
  ...over,
})

describe('parsePlan — validate, coerce, or reject (never crash)', () => {
  it('accepts a well-formed plan', () => {
    const p = parsePlan('{"action":"metric_query","colleges":["CIT"],"city":"coimbatore","metric":"placements","confidence":"high","reasoning":"x"}')
    expect(p?.action).toBe('metric_query')
    expect(p?.colleges).toEqual(['CIT'])
  })

  it('rejects an unknown action (falls back)', () => {
    expect(parsePlan('{"action":"delete_everything","colleges":[]}')).toBeNull()
  })

  it('rejects non-JSON and empty', () => {
    expect(parsePlan('the answer is PSG')).toBeNull()
    expect(parsePlan('')).toBeNull()
  })

  it('clamps a runaway limit and drops non-string colleges', () => {
    const p = parsePlan('{"action":"list_colleges","city":"chennai","limit":9999,"colleges":[1,2,"psg"]}')
    expect(p?.limit).toBe(50)
    expect(p?.colleges).toEqual(['psg']) // the numbers dropped — words only
  })

  it('coerces a bad confidence to low', () => {
    expect(parsePlan('{"action":"recommend","confidence":"banana"}')?.confidence).toBe('low')
  })
})

describe('expandCollegeWord — abbreviations, with CIT disambiguated by city', () => {
  it('expands known acronyms the fuzzy matcher cannot crack', () => {
    expect(expandCollegeWord('SSN', null)).toMatch(/Sivasubramaniya/)
    expect(expandCollegeWord('TCE', null)).toMatch(/Thiagarajar/)
  })
  it('disambiguates CIT by the city the planner also extracted', () => {
    expect(expandCollegeWord('CIT', 'chennai')).toBe('Chennai Institute of Technology')
    expect(expandCollegeWord('CIT', 'coimbatore')).toBe('Coimbatore Institute of Technology')
  })
  it('leaves an ordinary word untouched', () => {
    expect(expandCollegeWord('Kumaraguru', null)).toBe('Kumaraguru')
  })
})

describe('translatePlan — plan → clean canonical trigger (engine path unchanged)', () => {
  it('eligibility_at_college → a canonical eligibility trigger naming the resolved college', () => {
    const a = translatePlan(plan({ action: 'eligibility_at_college', colleges: ['psg'] }))
    expect(a).toEqual({ kind: 'rewrite', message: 'can i get into PSG College of Technology', needsCollege: true })
  })
  it('metric_query → "<metric> at <expanded college>"', () => {
    const a = translatePlan(plan({ action: 'metric_query', colleges: ['CIT'], city: 'coimbatore', metric: 'placements' }))
    expect(a).toEqual({ kind: 'rewrite', message: 'placements at Coimbatore Institute of Technology', needsCollege: true })
  })
  it('list_colleges → a list action carrying the city and count', () => {
    expect(translatePlan(plan({ action: 'list_colleges', city: 'chennai', limit: 10 }))).toEqual({ kind: 'list', city: 'chennai', count: 10, branch: null })
  })
  it('out_of_scope → decline', () => {
    expect(translatePlan(plan({ action: 'out_of_scope' }))).toEqual({ kind: 'decline' })
  })
  it('a college action with NO college → null (fall back, never guess)', () => {
    expect(translatePlan(plan({ action: 'eligibility_at_college', colleges: [] }))).toBeNull()
    expect(translatePlan(plan({ action: 'compare', colleges: ['psg'] }))).toBeNull() // needs two
  })
  it('need_more_info → null (let the deterministic path ask normally)', () => {
    expect(translatePlan(plan({ action: 'need_more_info' }))).toBeNull()
  })
})

describe('createCounselorPlanner — degrade gracefully, never throw', () => {
  it('returns null when the provider is unreachable', async () => {
    const p = createCounselorPlanner(createUnavailableProvider('none'))
    expect(await p.plan({ message: 'x', profile: null, memory: { lastDiscussedCollege: null, lastRecommendedSet: [] } })).toBeNull()
  })
  it('returns null on garbage output, and a plan on valid JSON', async () => {
    const garbage = createCounselorPlanner(createFunctionProvider('g', () => ({ text: 'not json at all', model: 'g', finishReason: 'stop' })))
    expect(await garbage.plan({ message: 'x', profile: null, memory: { lastDiscussedCollege: null, lastRecommendedSet: [] } })).toBeNull()

    const good = createCounselorPlanner(
      createFunctionProvider('ok', () => ({ text: '{"action":"list_colleges","city":"salem","limit":5,"colleges":[],"confidence":"high","reasoning":"x"}', model: 'ok', finishReason: 'stop' })),
    )
    const out = await good.plan({ message: 'colleges in salem', profile: null, memory: { lastDiscussedCollege: null, lastRecommendedSet: [] } })
    expect(out?.action).toBe('list_colleges')
    expect(out?.city).toBe('salem')
  })
})
