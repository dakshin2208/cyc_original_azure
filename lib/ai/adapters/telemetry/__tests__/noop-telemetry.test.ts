/** No-op telemetry adapter tests: implements the port without throwing. */

import { describe, expect, it } from 'vitest'
import { createNoopTelemetry } from '@/lib/ai/adapters'

describe('NoopTelemetry', () => {
  it('creates spans and records without throwing', () => {
    const telemetry = createNoopTelemetry()
    const span = telemetry.startSpan('unit.test', { attr: 1 })
    expect(() => {
      span.setAttribute('k', 'v')
      span.recordError(new Error('ignored'))
      span.end()
    }).not.toThrow()
  })

  it('accepts metrics without throwing', () => {
    const telemetry = createNoopTelemetry()
    expect(() => telemetry.metric('latency_ms', 12, { route: 'chat' })).not.toThrow()
  })
})
