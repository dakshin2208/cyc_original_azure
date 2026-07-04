/**
 * @module lib/ai/chat/__tests__/route.test
 *
 * The Next.js POST /api/chat handler — exercised through the real route module
 * with a stub service injected via the container's test seam. Confirms JSON
 * plumbing, status codes, POST-only surface, and body-parse errors.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetChatService, setChatServiceOverride } from '@/lib/ai/chat'
import * as route from '@/app/api/chat/route'
import { makeService } from './support'

const url = 'http://localhost/api/chat'
const post = (body: string): Request =>
  new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } })

beforeEach(() => setChatServiceOverride(makeService().service))
afterEach(() => resetChatService())

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
})
