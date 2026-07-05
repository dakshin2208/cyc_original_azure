/**
 * @module lib/ai/orchestration/__tests__/conversation-state.test
 * Conversation state — immutable, session-scoped accumulation.
 */

import { describe, expect, it } from 'vitest'
import { applyTurn, createConversationState } from '@/lib/ai/orchestration'
import { makeHarness, NAME, SESSION } from './support'

const { ai } = makeHarness()

describe('conversation state', () => {
  it('starts empty for a session', () => {
    const s = createConversationState(SESSION)
    expect(s.turnCount).toBe(0)
    expect(s.currentIntent).toBeNull()
    expect(s.mentionedColleges).toEqual([])
  })

  it('advances immutably and accumulates mentioned colleges across turns', () => {
    const s0 = createConversationState(SESSION)
    const t1 = ai.orchestrate('placements at psg college of technology')
    const s1 = applyTurn(s0, t1.parsed, t1.context)
    const t2 = ai.orchestrate('compare anna university and kumaraguru college of technology')
    const s2 = applyTurn(s1, t2.parsed, t2.context)

    expect(s0.turnCount).toBe(0) // original untouched
    expect(s1.turnCount).toBe(1)
    expect(s2.turnCount).toBe(2)
    expect(s2.currentIntent).toBe('compare_colleges')
    expect(s2.mentionedColleges).toEqual(
      expect.arrayContaining([NAME.psg, NAME.anna, NAME.kumaraguru]),
    )
    expect(s2.previousComparisons.length).toBe(1)
  })

  it('records recommendations and clarification requests', () => {
    const t1 = ai.orchestrate('recommend the best college')
    const s1 = applyTurn(createConversationState(SESSION), t1.parsed, t1.context)
    expect(s1.previousRecommendations.length).toBeGreaterThan(0)

    const t2 = ai.orchestrate('am i eligible')
    const s2 = applyTurn(s1, t2.parsed, t2.context)
    expect(s2.clarificationRequests.length).toBeGreaterThan(0)
  })

  it('tracks mentioned branches', () => {
    const t = ai.orchestrate('best college for mechanical engineering')
    const s = applyTurn(createConversationState(SESSION), t.parsed, t.context)
    expect(s.mentionedBranches).toContain('Mechanical Engineering')
  })

  it('the orchestrator returns an advanced state each turn', () => {
    const first = ai.orchestrate('recommend a good college')
    expect(first.state.turnCount).toBe(1)
    const second = ai.orchestrate('compare psg and anna university', first.state)
    expect(second.state.turnCount).toBe(2)
  })
})
