/**
 * @module lib/ai/chat/__tests__/capability-registry.test
 *
 * The Capability Registry in isolation (Phase 5). Proves it is a pure dispatcher:
 * register / discover / resolve / invoke, with no orchestration or reasoning of its own.
 * The default registry must cover every decision kind the brain can emit, and each
 * dispatch must call the coordinator-provided primitive (finish / answer / recordExclusion).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createCapabilityRegistry,
  createDefaultCapabilityRegistry,
  emptyProfile,
  type CapabilityContext,
  type CounselorDecision,
} from '@/lib/ai/chat'

/** A recording fake of the execution primitives the registry dispatches to. */
function fakeContext() {
  const calls = { finish: [] as Array<[string, string]>, answer: [] as Array<[string, unknown, string | undefined]>, exclusions: [] as string[][] }
  const ctx: CapabilityContext = {
    message: 'give me options',
    profile: emptyProfile(),
    priorProfile: emptyProfile(),
    echo: 'ECHO',
    isParent: false,
    finish: (text, stage) => {
      calls.finish.push([text, stage])
      return { httpStatus: 200, body: { answer: text } } as never
    },
    answer: async (m, _p, intro) => {
      calls.answer.push([m, _p, intro])
      return { httpStatus: 200, body: { answer: m } } as never
    },
    recordExclusion: async (colleges) => {
      calls.exclusions.push([...colleges])
    },
  }
  return { ctx, calls }
}

const ALL_KINDS: CounselorDecision['kind'][] = [
  'collectSlot',
  'onboardingSummary',
  'exclude',
  'profileChanged',
  'preferenceList',
  'tier',
  'compareNeedsTwo',
  'refine',
  'dataDecline',
  'answerQuestion',
  'social',
  'recommend',
]

describe('Capability Registry — dispatcher', () => {
  it('registers, discovers, resolves and invokes a handler', async () => {
    const { ctx } = fakeContext()
    const handler = vi.fn(() => ({ httpStatus: 200, body: {} }) as never)
    const registry = createCapabilityRegistry().register('social', handler)
    expect(registry.has('social')).toBe(true)
    expect(registry.kinds()).toContain('social')
    await registry.dispatch({ kind: 'social' }, ctx)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('throws when no capability is registered for a decision', async () => {
    const { ctx } = fakeContext()
    await expect(createCapabilityRegistry().dispatch({ kind: 'recommend' }, ctx)).rejects.toThrow(/no capability/i)
  })
})

describe('Capability Registry — default registry', () => {
  it('covers every decision kind the brain can emit', () => {
    const registry = createDefaultCapabilityRegistry()
    for (const kind of ALL_KINDS) expect(registry.has(kind)).toBe(true)
    expect(registry.kinds()).toHaveLength(ALL_KINDS.length)
  })

  it('dispatches recommend → answer with the recommendation trigger', async () => {
    const { ctx, calls } = fakeContext()
    await createDefaultCapabilityRegistry().dispatch({ kind: 'recommend' }, ctx)
    expect(calls.answer).toHaveLength(1)
    expect(calls.answer[0][0]).toBe('recommend the best colleges for me')
  })

  it('dispatches social → a deterministic finish (no reasoning)', async () => {
    const { ctx, calls } = fakeContext()
    await createDefaultCapabilityRegistry().dispatch({ kind: 'social' }, ctx)
    expect(calls.answer).toHaveLength(0)
    expect(calls.finish).toHaveLength(1)
    expect(calls.finish[0][1]).toBe('ready')
  })

  it('dispatches exclude → records the exclusion then re-counsels', async () => {
    const { ctx, calls } = fakeContext()
    await createDefaultCapabilityRegistry().dispatch({ kind: 'exclude', colleges: ['PSG College of Technology'] }, ctx)
    expect(calls.exclusions).toEqual([['PSG College of Technology']])
    expect(calls.answer).toHaveLength(1)
  })
})
