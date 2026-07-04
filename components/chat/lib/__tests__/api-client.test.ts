/**
 * @module components/chat/lib/__tests__/api-client.test
 * Typed /api/chat client — success, error mapping, retry, timeout, cancel.
 */

import { describe, expect, it, vi } from 'vitest'
import { createChatClient } from '../api-client'
import type { ChatResponse } from '../types'

const RESPONSE: ChatResponse = {
  answer: 'ok',
  citations: [],
  confidence: 'high',
  followUps: [],
  conversationId: 'c1',
}

/** A minimal Response-like object the client consumes. */
const res = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const noSleep = async (): Promise<void> => undefined

describe('chat api client', () => {
  it('returns data on 200', async () => {
    const fetchImpl = vi.fn(async () => res(200, RESPONSE)) as unknown as typeof fetch
    const client = createChatClient({ fetchImpl, sleep: noSleep })
    const result = await client.send({ message: 'hi' })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data?.conversationId).toBe('c1')
    expect(result.attempts).toBe(1)
  })

  it('includes conversationId in the request body when supplied', async () => {
    const fetchImpl = vi.fn(async () => res(200, RESPONSE)) as unknown as typeof fetch
    await createChatClient({ fetchImpl, sleep: noSleep }).send({ message: 'hi', conversationId: 'c9' })
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({ message: 'hi', conversationId: 'c9' })
  })

  it('maps a 400 to a non-retryable validation error (single attempt)', async () => {
    const fetchImpl = vi.fn(async () => res(400, { code: 'invalid_request' }))
    const client = createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })
    const result = await client.send({ message: 'x' })
    expect(result.ok).toBe(false)
    expect(result.error?.kind).toBe('validation')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a transient 503 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(503, { code: 'provider_unavailable' }))
      .mockResolvedValueOnce(res(200, RESPONSE))
    const client = createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep, retries: 1 })
    const result = await client.send({ message: 'x' })
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting retries on a persistent 500', async () => {
    const fetchImpl = vi.fn(async () => res(500, {}))
    const client = createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep, retries: 1 })
    const result = await client.send({ message: 'x' })
    expect(result.ok).toBe(false)
    expect(result.error?.kind).toBe('server')
    expect(result.attempts).toBe(2)
  })

  it('retries a network failure then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(res(200, RESPONSE))
    const client = createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep, retries: 1 })
    const result = await client.send({ message: 'x' })
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
  })

  it('maps a timeout when the request exceeds the budget', async () => {
    // A fetch that only settles when its signal aborts.
    const fetchImpl = ((_url: string, init: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })) as unknown as typeof fetch
    const client = createChatClient({ fetchImpl, sleep: noSleep, timeoutMs: 10, retries: 0 })
    const result = await client.send({ message: 'x' })
    expect(result.ok).toBe(false)
    expect(result.error?.kind).toBe('timeout')
  })

  it('returns canceled (no retry) when the external signal is already aborted', async () => {
    const fetchImpl = vi.fn(async () => res(200, RESPONSE))
    const controller = new AbortController()
    controller.abort()
    const client = createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })
    const result = await client.send({ message: 'x' }, { signal: controller.signal })
    expect(result.error?.kind).toBe('canceled')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
