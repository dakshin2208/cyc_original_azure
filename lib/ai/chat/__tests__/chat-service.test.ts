/**
 * @module lib/ai/chat/__tests__/chat-service.test
 * Chat service — validation, pipeline, conversation continuity, error mapping.
 */

import { describe, expect, it } from 'vitest'
import type { ChatResponse } from '@/lib/ai/chat'
import {
  createUnavailableProvider,
  hangingProvider,
  jsonRejectProvider,
  makeService,
  orchestrator,
  textProvider,
} from './support'

function ok(body: unknown): ChatResponse {
  return body as ChatResponse
}

describe('chat service — happy path', () => {
  it('answers a valid message with a grounded response', async () => {
    const { service } = makeService()
    const outcome = await service.handle({ message: 'recommend the best college' })
    expect(outcome.httpStatus).toBe(200)
    const body = ok(outcome.body)
    expect(body.answer.length).toBeGreaterThan(0)
    expect(body.conversationId).toBe('conv-1')
    expect(['high', 'medium', 'low']).toContain(body.confidence)
  })

  it('cites only real evidence ids from the orchestrated context', async () => {
    const { service } = makeService()
    const outcome = await service.handle({ message: 'what are the placements at PSG College of Technology' })
    const body = ok(outcome.body)
    const validIds = new Set(orchestrator.orchestrate('what are the placements at PSG College of Technology').context.evidence.items.map((e) => e.id))
    for (const c of body.citations) expect(validIds.has(c.evidenceId)).toBe(true)
  })
})

describe('chat service — request validation', () => {
  it('rejects a non-object payload', async () => {
    const { service } = makeService()
    expect((await service.handle('nope')).httpStatus).toBe(400)
    expect((await service.handle({ notMessage: 1 })).httpStatus).toBe(400)
  })

  it('rejects an empty message', async () => {
    const { service } = makeService()
    const outcome = await service.handle({ message: '   ' })
    expect(outcome.httpStatus).toBe(400)
    expect((outcome.body as { code: string }).code).toBe('empty_message')
  })

  it('rejects an over-long message', async () => {
    const { service } = makeService({ maxMessageLength: 10 })
    const outcome = await service.handle({ message: 'x'.repeat(50) })
    expect(outcome.httpStatus).toBe(413)
  })
})

describe('chat service — conversation continuity', () => {
  it('carries state across turns via conversationId', async () => {
    const { service, store } = makeService()
    const first = ok((await service.handle({ message: 'placements at PSG College of Technology' })).body)
    const id = first.conversationId
    await service.handle({ message: 'compare Anna University and Kumaraguru College of Technology', conversationId: id })

    const state = await store.get(id)
    expect(state?.turnCount).toBe(2)
    expect(state?.mentionedColleges.length).toBeGreaterThanOrEqual(2)
  })

  it('starts a fresh conversation when no id is supplied', async () => {
    const { service } = makeService({ idGenerator: (() => { let i = 0; return () => `s-${(i += 1)}` })() })
    const a = ok((await service.handle({ message: 'recommend a college' })).body)
    const b = ok((await service.handle({ message: 'recommend a college' })).body)
    expect(a.conversationId).toBe('s-1')
    expect(b.conversationId).toBe('s-2')
  })
})

describe('chat service — error mapping', () => {
  it('maps provider unavailability to 503 with a safe fallback', async () => {
    const { service } = makeService({ provider: createUnavailableProvider('down') })
    const outcome = await service.handle({ message: 'am i eligible for a good college' })
    expect(outcome.httpStatus).toBe(503)
    const body = outcome.body as { code: string; answer?: string; followUps?: unknown[] }
    expect(body.code).toBe('provider_unavailable')
    expect(body.answer && body.answer.length).toBeGreaterThan(0)
    expect((body.followUps ?? []).length).toBeGreaterThan(0)
  })

  it('maps a timeout to 504', async () => {
    const { service } = makeService({ provider: hangingProvider(), timeoutMs: 20 })
    const outcome = await service.handle({ message: 'recommend a college' })
    expect(outcome.httpStatus).toBe(504)
    expect((outcome.body as { code: string }).code).toBe('timeout')
  })

  it('maps unparseable model output to 502', async () => {
    const { service } = makeService({ provider: textProvider('not json at all') })
    const outcome = await service.handle({ message: 'recommend a college' })
    expect(outcome.httpStatus).toBe(502)
    expect((outcome.body as { code: string }).code).toBe('upstream_invalid')
  })

  it('maps a fabricated-citation rejection to 502', async () => {
    const { service } = makeService({ provider: jsonRejectProvider() })
    const outcome = await service.handle({ message: 'recommend a college' })
    expect(outcome.httpStatus).toBe(502)
  })
})

describe('chat service — determinism & logging', () => {
  it('produces identical responses for identical inputs', async () => {
    const a = ok((await makeService().service.handle({ message: 'recommend a college' })).body)
    const b = ok((await makeService().service.handle({ message: 'recommend a college' })).body)
    expect(a).toEqual(b)
  })

  it('logs structured events without the message content', async () => {
    const { service, logger } = makeService()
    await service.handle({ message: 'a secret question about PSG' })
    const events = logger.events.map((e) => e.event)
    expect(events).toContain('request')
    expect(events).toContain('orchestrated')
    expect(events).toContain('llm')
    expect(events).toContain('response')
    // No event carries the raw message text.
    const serialized = JSON.stringify(logger.events)
    expect(serialized).not.toContain('secret question')
  })
})
