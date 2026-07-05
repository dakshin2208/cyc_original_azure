/**
 * @module lib/ai/chat/__tests__/route.test
 *
 * The Next.js POST /api/chat handler — exercised through the real route module
 * with a stub service injected via the container's test seam. Confirms JSON
 * plumbing, status codes, POST-only surface, and body-parse errors.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  resetChatService,
  setChatServiceOverride,
  resetChatUsageGuard,
  setChatUsageGuardOverride,
  type ChatUsageGuard,
} from '@/lib/ai/chat'
import * as route from '@/app/api/chat/route'
import { makeService } from './support'

const url = 'http://localhost/api/chat'
const post = (body: string): Request =>
  new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } })

/** A guard that authenticates a fixed user under their limit (records into `rec`). */
const allowGuard = (rec = { n: 0 }): ChatUsageGuard => ({
  check: async () => ({ allow: true, userId: 'u1', email: 'a@b.com', planType: 'freemium' }),
  record: async () => {
    rec.n += 1
  },
})

beforeEach(() => {
  setChatServiceOverride(makeService().service)
  setChatUsageGuardOverride(allowGuard())
})
afterEach(() => {
  resetChatService()
  resetChatUsageGuard()
})

describe('POST /api/chat', () => {
  it('returns 200 with the chat response body', async () => {
    const res = await route.POST(post(JSON.stringify({ message: 'recommend a college' })))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { answer: string; conversationId: string }
    expect(body.answer.length).toBeGreaterThan(0)
    expect(body.conversationId).toBe('conv-1')
  })

  it('threads a conversationId across requests', async () => {
    const first = await (await route.POST(post(JSON.stringify({ message: 'placements at PSG College of Technology' })))).json()
    const id = (first as { conversationId: string }).conversationId
    const res = await route.POST(post(JSON.stringify({ message: 'and Anna University?', conversationId: id })))
    expect((await res.json() as { conversationId: string }).conversationId).toBe(id)
  })

  it('returns 400 on a non-JSON body', async () => {
    const res = await route.POST(post('this is not json{'))
    expect(res.status).toBe(400)
    expect((await res.json() as { code: string }).code).toBe('invalid_request')
  })

  it('returns 400 on a payload without a message', async () => {
    const res = await route.POST(post(JSON.stringify({ foo: 'bar' })))
    expect(res.status).toBe(400)
  })

  it('returns a coded 500 (not a leaked stack) if the service rejects', async () => {
    // Simulate a conformant async store fault (e.g. a future Redis network error).
    setChatServiceOverride({ handle: () => Promise.reject(new Error('redis connection reset')) })
    const res = await route.POST(post(JSON.stringify({ message: 'recommend a college' })))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { code: string; error: string }
    expect(body.code).toBe('internal_error')
    expect(body.error).not.toContain('redis') // no internals leaked
  })

  it('exposes POST only (no other method handlers)', () => {
    expect(typeof route.POST).toBe('function')
    const r = route as unknown as Record<string, unknown>
    expect(r.GET).toBeUndefined()
    expect(r.PUT).toBeUndefined()
    expect(r.DELETE).toBeUndefined()
  })

  // ── Auth + per-plan question limit (production integration) ──────────────────

  it('returns 401 for an anonymous request (no valid session) — cannot bypass', async () => {
    let handled = false
    setChatServiceOverride({
      handle: async () => {
        handled = true
        return { httpStatus: 200, body: { answer: 'x', conversationId: 'c', citations: [], confidence: 'low', followUps: [] } }
      },
    })
    setChatUsageGuardOverride({
      check: async () => ({ allow: false, status: 401, code: 'unauthenticated', message: 'sign in' }),
      record: async () => {},
    })
    const res = await route.POST(post(JSON.stringify({ message: 'hi' })))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('unauthenticated')
    expect(handled).toBe(false) // the chat service is never reached
  })

  it('returns 429 when the plan question limit is reached', async () => {
    setChatUsageGuardOverride({
      check: async () => ({ allow: false, status: 429, code: 'limit_reached', message: 'upgrade' }),
      record: async () => {},
    })
    const res = await route.POST(post(JSON.stringify({ message: 'hi' })))
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('limit_reached')
  })

  it('records exactly one question on a successful answer', async () => {
    const rec = { n: 0 }
    setChatUsageGuardOverride(allowGuard(rec))
    await route.POST(post(JSON.stringify({ message: 'recommend a college' })))
    expect(rec.n).toBe(1)
  })

  it('does NOT count a profile-collection turn (stage: collecting) against the quota', async () => {
    const rec = { n: 0 }
    setChatServiceOverride({
      handle: async () => ({
        httpStatus: 200,
        body: { answer: 'What is your cutoff?', conversationId: 'c', citations: [], confidence: 'low', followUps: [], stage: 'collecting' },
      }),
    })
    setChatUsageGuardOverride(allowGuard(rec))
    await route.POST(post(JSON.stringify({ message: 'hi' })))
    expect(rec.n).toBe(0)
  })

  it('fails closed (503) if the usage backend faults — never grants free unlimited', async () => {
    setChatUsageGuardOverride({
      check: async () => {
        throw new Error('db down')
      },
      record: async () => {},
    })
    const res = await route.POST(post(JSON.stringify({ message: 'hi' })))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('usage_unavailable')
  })
})
