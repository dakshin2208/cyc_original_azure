/**
 * @module components/chat/lib/__tests__/errors.test
 * HTTP status + exception → normalized, user-friendly ChatApiError.
 */

import { describe, expect, it } from 'vitest'
import { USER_MESSAGE, errorForException, errorForStatus } from '../errors'

describe('errorForStatus', () => {
  it('classifies each documented status', () => {
    expect(errorForStatus(400).kind).toBe('validation')
    expect(errorForStatus(422).kind).toBe('validation')
    expect(errorForStatus(429).kind).toBe('rate_limited')
    expect(errorForStatus(500).kind).toBe('server')
    expect(errorForStatus(503).kind).toBe('unavailable')
    expect(errorForStatus(504).kind).toBe('timeout')
  })

  it('marks only transient failures retryable', () => {
    expect(errorForStatus(400).retryable).toBe(false)
    expect(errorForStatus(422).retryable).toBe(false)
    expect(errorForStatus(429).retryable).toBe(true)
    expect(errorForStatus(500).retryable).toBe(true)
    expect(errorForStatus(503).retryable).toBe(true)
    expect(errorForStatus(504).retryable).toBe(true)
  })

  it('carries the backend code and http status without leaking internals', () => {
    const e = errorForStatus(503, { code: 'provider_unavailable' })
    expect(e.code).toBe('provider_unavailable')
    expect(e.httpStatus).toBe(503)
    expect(e.message).toBe(USER_MESSAGE.unavailable)
    expect(e.message).not.toMatch(/stack|Error:|undefined/)
  })
})

describe('errorForException', () => {
  it('maps a timeout, a cancel, and a network failure', () => {
    expect(errorForException(new Error('x'), true).kind).toBe('timeout')
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(errorForException(abort).kind).toBe('canceled')
    expect(errorForException(new TypeError('Failed to fetch')).kind).toBe('network')
    expect(errorForException({}).kind).toBe('unknown')
  })

  it('every kind has a friendly message', () => {
    for (const kind of Object.keys(USER_MESSAGE)) {
      expect(USER_MESSAGE[kind as keyof typeof USER_MESSAGE].length).toBeGreaterThan(0)
    }
  })
})
