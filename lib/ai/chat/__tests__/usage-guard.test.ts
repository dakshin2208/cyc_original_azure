/**
 * @module lib/ai/chat/__tests__/usage-guard.test
 *
 * The AI-chat auth + per-plan question-limit guard. Uses an in-memory store double
 * (no Supabase) so the decision logic — authenticate, resolve plan, enforce
 * aiChatLimit, increment — is verified deterministically.
 */

import { describe, expect, it } from 'vitest'
import { createChatUsageGuard, withinLimit, bearerToken, type ChatUsageStore } from '@/lib/ai/chat'
import { getPlanLimits, type PlanType } from '@/lib/plans'

type Overrides = {
  user?: { id: string; email: string | null } | null
  plan?: PlanType
  used?: number
}

function fakeStore(o: Overrides = {}) {
  const state = { used: o.used ?? 0, increments: 0 }
  const store: ChatUsageStore = {
    verifyUser: async () => (o.user === undefined ? { id: 'u1', email: 'a@b.com' } : o.user),
    resolvePlan: async () => o.plan ?? 'freemium',
    readUsed: async () => state.used,
    increment: async () => {
      state.increments += 1
      state.used += 1
    },
  }
  return { store, state }
}

const req = (auth?: string): Request =>
  new Request('http://localhost/api/chat', { method: 'POST', headers: auth ? { authorization: auth } : {} })

describe('withinLimit (pure quota rule)', () => {
  it('allows strictly below the limit and rejects at/over it', () => {
    expect(withinLimit(0, 2)).toBe(true)
    expect(withinLimit(1, 2)).toBe(true)
    expect(withinLimit(2, 2)).toBe(false)
    expect(withinLimit(3, 2)).toBe(false)
  })
})

describe('bearerToken', () => {
  it('extracts a Bearer token (case-insensitive), else null', () => {
    expect(bearerToken(req('Bearer abc.def'))).toBe('abc.def')
    expect(bearerToken(req('bearer xyz'))).toBe('xyz')
    expect(bearerToken(req())).toBeNull()
    expect(bearerToken(req('Basic zzz'))).toBeNull()
  })
})

describe('ChatUsageGuard — auth', () => {
  it('rejects an anonymous request with 401 (cannot bypass by not logging in)', async () => {
    const { store } = fakeStore({ user: null })
    const out = await createChatUsageGuard(store).check(req())
    expect(out.allow).toBe(false)
    if (!out.allow) {
      expect(out.status).toBe(401)
      expect(out.code).toBe('unauthenticated')
    }
  })

  it('allows an authenticated user under their limit', async () => {
    const { store } = fakeStore({ user: { id: 'u9', email: 'x@y.com' }, plan: 'premium_199', used: 3 })
    const out = await createChatUsageGuard(store).check(req('Bearer t'))
    expect(out.allow).toBe(true)
    if (out.allow) {
      expect(out.userId).toBe('u9')
      expect(out.planType).toBe('premium_199')
    }
  })
})

describe('ChatUsageGuard — enforces the exact per-plan limits from lib/plans', () => {
  const cases: Array<{ plan: PlanType; label: string; limit: number }> = [
    { plan: 'freemium', label: 'Free', limit: 2 },
    { plan: 'premium_199', label: 'Secure', limit: 5 },
    { plan: 'premium_299', label: 'Assured', limit: 8 },
    { plan: 'premium_499', label: 'Assured+', limit: 20 },
    { plan: 'referral_75', label: 'Secure', limit: 5 },
    { plan: 'referral_300', label: 'Assured+', limit: 20 },
  ]

  for (const c of cases) {
    it(`${c.label} (${c.plan}) allows question #${c.limit} and blocks #${c.limit + 1}`, async () => {
      // sanity: the constant is the single source of truth
      expect(getPlanLimits(c.plan).aiChatLimit).toBe(c.limit)

      // used = limit-1 → still allowed (this is the last permitted question)
      const under = fakeStore({ plan: c.plan, used: c.limit - 1 })
      expect((await createChatUsageGuard(under.store).check(req('Bearer t'))).allow).toBe(true)

      // used = limit → blocked with 429 limit_reached
      const at = fakeStore({ plan: c.plan, used: c.limit })
      const out = await createChatUsageGuard(at.store).check(req('Bearer t'))
      expect(out.allow).toBe(false)
      if (!out.allow) {
        expect(out.status).toBe(429)
        expect(out.code).toBe('limit_reached')
        expect(out.message).toContain(String(c.limit))
      }
    })
  }
})

describe('ChatUsageGuard — record', () => {
  it('increments the user\'s consumed questions', async () => {
    const { store, state } = fakeStore({ plan: 'freemium', used: 0 })
    const guard = createChatUsageGuard(store)
    await guard.record('u1', 'a@b.com', 'freemium')
    await guard.record('u1', 'a@b.com', 'freemium')
    expect(state.increments).toBe(2)
    expect(state.used).toBe(2)
  })

  it('a freemium user is blocked after consuming both questions (end-to-end via the store)', async () => {
    const { store } = fakeStore({ plan: 'freemium', used: 0 })
    const guard = createChatUsageGuard(store)
    expect((await guard.check(req('Bearer t'))).allow).toBe(true) // Q1
    await guard.record('u1', 'a@b.com', 'freemium')
    expect((await guard.check(req('Bearer t'))).allow).toBe(true) // Q2
    await guard.record('u1', 'a@b.com', 'freemium')
    expect((await guard.check(req('Bearer t'))).allow).toBe(false) // Q3 blocked (limit 2)
  })
})
