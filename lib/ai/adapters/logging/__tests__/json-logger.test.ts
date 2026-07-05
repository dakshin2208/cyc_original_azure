/**
 * JSON logger tests: level filtering, correlation ids, child bindings, and PII
 * redaction.
 */

import { describe, expect, it } from 'vitest'
import { traceId } from '@/lib/ai/shared'
import { createJsonLogger } from '@/lib/ai/adapters'
import { FakeClock, capturingSink } from '@/lib/ai/__tests__/support'

const clock = new FakeClock()

describe('JsonLogger', () => {
  it('emits structured JSON with timestamp and message', () => {
    const { sink, lines } = capturingSink()
    const logger = createJsonLogger({ level: 'debug', pretty: false }, clock, sink)
    logger.info({ message: 'hello' })

    expect(lines).toHaveLength(1)
    const record = JSON.parse(lines[0])
    expect(record).toMatchObject({ level: 'info', message: 'hello', time: '2026-01-01T00:00:00.000Z' })
  })

  it('filters events below the configured level', () => {
    const { sink, lines } = capturingSink()
    const logger = createJsonLogger({ level: 'warn', pretty: false }, clock, sink)
    logger.debug({ message: 'd' })
    logger.info({ message: 'i' })
    logger.warn({ message: 'w' })
    logger.error({ message: 'e' })

    expect(lines).toHaveLength(2)
    expect(lines.map((l) => JSON.parse(l).level)).toEqual(['warn', 'error'])
  })

  it('includes the correlation id when provided', () => {
    const { sink, lines } = capturingSink()
    const logger = createJsonLogger({ level: 'info', pretty: false }, clock, sink)
    logger.info({ message: 'm', traceId: traceId('trace-42') })
    expect(JSON.parse(lines[0]).traceId).toBe('trace-42')
  })

  it('merges child bindings into every event', () => {
    const { sink, lines } = capturingSink()
    const logger = createJsonLogger({ level: 'info', pretty: false }, clock, sink).child({
      component: 'provider',
    })
    logger.info({ message: 'm' })
    expect(JSON.parse(lines[0]).component).toBe('provider')
  })

  it('redacts sensitive keys from structured data', () => {
    const { sink, lines } = capturingSink()
    const logger = createJsonLogger({ level: 'info', pretty: false }, clock, sink)
    logger.info({
      message: 'm',
      data: { email: 'a@b.com', apiKey: 'sk-secret', nested: { serviceRoleKey: 'x' }, safe: 'ok' },
    })

    const data = JSON.parse(lines[0]).data
    expect(data.email).toBe('[REDACTED]')
    expect(data.apiKey).toBe('[REDACTED]')
    expect(data.nested.serviceRoleKey).toBe('[REDACTED]')
    expect(data.safe).toBe('ok')
  })
})
