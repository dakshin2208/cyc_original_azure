/**
 * @module lib/ai/orchestration/__tests__/orchestrator.test
 * AIOrchestrator — end-to-end routing per intent, resilience, determinism.
 */

import { describe, expect, it } from 'vitest'
import type { OrchestrationResult } from '@/lib/ai/orchestration'
import { makeHarness, NAME } from './support'

const { ai } = makeHarness()

/** Every orchestration must yield a coherent, non-throwing result. */
function assertWellFormed(r: OrchestrationResult): void {
  expect(r.parsed).toBeDefined()
  expect(r.context.intent).toBe(r.parsed.intent)
  expect(r.prompt.messages.length).toBe(2)
  expect(r.prompt.system.length).toBeGreaterThan(0)
  expect(r.state.turnCount).toBe(1)
}

describe('orchestrator — routing by intent', () => {
  it('recommend_college → produces ranked recommendations', () => {
    const r = ai.orchestrate('recommend the best college')
    assertWellFormed(r)
    expect(r.context.recommendations.length).toBeGreaterThan(0)
    expect(r.context.recommendations[0].category).toBe('best_overall')
  })

  it('recommend_college with government category → government strategy', () => {
    const r = ai.orchestrate('recommend a government college')
    expect(r.context.recommendations.every((x) => x.category === 'government_college')).toBe(true)
  })

  it('best-placement when no college is named', () => {
    const r = ai.orchestrate('which college has the best placements')
    expect(r.context.recommendations[0]?.category).toBe('best_placement')
  })

  it('placement_query for a named college → retrieved facts, no ranking', () => {
    const r = ai.orchestrate(`what are the placements at ${NAME.psg}`)
    expect(r.context.subjects.map((c) => c.name)).toContain(NAME.psg)
    expect(r.context.facts.some((f) => f.origin === 'placement')).toBe(true)
    expect(r.context.recommendations).toHaveLength(0)
  })

  it('compare_colleges → comparison + evidence from the comparison engine', () => {
    const r = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    expect(r.context.comparison).not.toBeNull()
    expect(r.context.evidence.bySource.comparison).toBeGreaterThan(0)
  })

  it('roi_query → ROI strategy with the fees caveat', () => {
    const r = ai.orchestrate('which college gives the best roi')
    expect(r.context.recommendations[0]?.category).toBe('best_roi')
    expect(r.context.notes.join(' ')).toMatch(/fees/i)
  })

  it('eligibility_query without cutoff → blocked, asks follow-ups, does not throw', () => {
    const r = ai.orchestrate('am i eligible for anna university')
    assertWellFormed(r)
    expect(r.context.recommendations).toHaveLength(0)
    expect(r.context.followUpQuestions.length).toBeGreaterThan(0)
  })

  it('handles empty and garbage input as unknown without throwing', () => {
    for (const q of ['', '   ', 'asdf qwer zxcv', '!!!???']) {
      const r = ai.orchestrate(q)
      expect(r.parsed.intent).toBe('unknown')
      expect(r.context.recommendations).toHaveLength(0)
      expect(r.prompt.messages.length).toBe(2) // still a valid prompt
    }
  })

  it('never invents data — every prompt college comes from resolved subjects/recommendations', () => {
    const r = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    const allowed = new Set<string>([
      ...r.context.subjects.map((c) => c.name),
      ...r.context.recommendations.map((x) => x.college.name),
      ...r.context.evidence.items.map((e) => e.collegeName ?? ''),
    ])
    // The kumaraguru college was not part of this query and must not appear.
    expect(allowed.has(NAME.kumaraguru)).toBe(false)
    expect(r.prompt.context).not.toContain(NAME.kumaraguru)
  })

  it('is fully deterministic', () => {
    const a = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    const b = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    expect(a.prompt.messages).toEqual(b.prompt.messages)
    expect(a.context.evidence.items.map((i) => i.id)).toEqual(b.context.evidence.items.map((i) => i.id))
  })

  it('exposes deterministic parse() independently of the full pipeline', () => {
    expect(ai.parse('recommend a college').intent).toBe('recommend_college')
  })
})
