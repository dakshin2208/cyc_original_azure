/**
 * Composition-root & container tests: single-boot wiring, override injection,
 * safe ConfigPort exposure, request-context creation, immutability, shutdown.
 */

import { describe, expect, it } from 'vitest'
import { sessionId, ConfigError } from '@/lib/ai/shared'
import { createAiApplication } from '@/lib/ai/runtime'
import { FakeClock, FakeLlm, capturingSink, testAuth, testEnv } from '@/lib/ai/__tests__/support'

describe('createAiApplication — wiring', () => {
  it('boots with defaults and exposes every port on the container', () => {
    const app = createAiApplication({ env: testEnv(), logSink: () => {} })
    const c = app.container
    expect(c.config).toBeDefined()
    expect(c.logger).toBeDefined()
    expect(c.clock).toBeDefined()
    expect(c.telemetry).toBeDefined()
    expect(c.llm).toBeDefined()
    expect(c.sql).toBeDefined()
    expect(c.vectorIndex).toBeDefined()
  })

  it('produces a frozen (immutable) container', () => {
    const app = createAiApplication({ env: testEnv(), logSink: () => {} })
    expect(Object.isFrozen(app.container)).toBe(true)
  })

  it('injects overridden dependencies verbatim', async () => {
    const app = createAiApplication({
      env: testEnv(),
      overrides: { llm: new FakeLlm() },
      logSink: () => {},
    })
    const result = await app.container.llm.complete({ system: '', messages: [] }, 'fast', {} as never)
    expect(result.text).toBe('fake')
  })

  it('leaves un-overridden providers as fail-fast Null objects', async () => {
    const app = createAiApplication({ env: testEnv(), logSink: () => {} })
    await expect(
      app.container.sql.run({ name: 'x', params: {} }, {} as never),
    ).rejects.toBeInstanceOf(ConfigError)
  })

  it('surfaces feature flags through the safe ConfigPort', () => {
    const app = createAiApplication({
      env: testEnv({ AI_FLAG_RAG_ENABLED: 'true' }),
      logSink: () => {},
    })
    expect(app.container.config.flags().ragEnabled).toBe(true)
    expect(Object.keys(app.container.config.get()).sort()).toEqual([
      'defaultModelTier',
      'flags',
      'maxCandidateSet',
    ])
  })

  it('logs an initialization line to the injected sink', () => {
    const { sink, lines } = capturingSink()
    createAiApplication({ env: testEnv(), logSink: sink })
    expect(lines.some((l) => l.includes('AI application initialized'))).toBe(true)
  })
})

describe('createAiApplication — request context', () => {
  it('builds a per-turn context using the injected clock and id generator', () => {
    let seq = 0
    const app = createAiApplication({
      env: testEnv(),
      overrides: { clock: new FakeClock() },
      idGenerator: () => `id-${++seq}`,
      logSink: () => {},
    })

    const ctx = app.container.createRequestContext({
      sessionId: sessionId('sess-1'),
      auth: testAuth(),
    })

    expect(ctx.sessionId).toBe('sess-1')
    expect(ctx.turnId).toBe('id-1')
    expect(ctx.traceId).toBe('id-2')
    expect(ctx.startedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(ctx.userId).toBeNull()
    expect(Object.isFrozen(ctx)).toBe(true)
  })
})

describe('createAiApplication — lifecycle & failure', () => {
  it('resolves shutdown cleanly', async () => {
    const app = createAiApplication({ env: testEnv(), logSink: () => {} })
    await expect(app.shutdown()).resolves.toBeUndefined()
  })

  it('fails fast on invalid configuration', () => {
    expect(() => createAiApplication({ env: testEnv({ AI_LLM_PROVIDER: 'anthropic' }) })).toThrow(
      ConfigError,
    )
  })
})
