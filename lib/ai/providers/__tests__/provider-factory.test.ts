/**
 * Provider factory tests: fail-fast Null providers, boot-time error on an
 * unregistered selected provider, registered factory resolution, and overrides.
 */

import { describe, expect, it } from 'vitest'
import { ConfigError } from '@/lib/ai/shared'
import { loadAiConfig } from '@/lib/ai/config'
import { createJsonLogger } from '@/lib/ai/adapters'
import {
  createLlmProvider,
  createProviderRegistry,
  createSqlProvider,
  createVectorProvider,
} from '@/lib/ai/providers'
import { FakeClock, FakeLlm, FakeSql, FakeVector, testEnv } from '@/lib/ai/__tests__/support'

const clock = new FakeClock()
const deps = { logger: createJsonLogger({ level: 'error', pretty: false }, clock, () => {}), clock }

describe('createLlmProvider', () => {
  it('returns a Null provider when no provider is configured', async () => {
    const config = loadAiConfig(testEnv())
    const llm = createLlmProvider(config, deps, createProviderRegistry())
    await expect(llm.complete({ system: '', messages: [] }, 'fast', {} as never)).rejects.toBeInstanceOf(
      ConfigError,
    )
  })

  it('fails fast when a selected provider has no registered adapter', () => {
    const config = loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk' }))
    expect(() => createLlmProvider(config, deps, createProviderRegistry())).toThrow(ConfigError)
  })

  it('resolves a registered provider factory', async () => {
    const config = loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk' }))
    const registry = createProviderRegistry().registerLlm('anthropic', () => new FakeLlm())
    const llm = createLlmProvider(config, deps, registry)
    const result = await llm.complete({ system: '', messages: [] }, 'fast', {} as never)
    expect(result.text).toBe('fake')
  })

  it('prefers an explicit override over configuration', async () => {
    const config = loadAiConfig(testEnv()) // provider 'none'
    const llm = createLlmProvider(config, deps, createProviderRegistry(), new FakeLlm())
    const result = await llm.complete({ system: '', messages: [] }, 'fast', {} as never)
    expect(result.text).toBe('fake')
  })
})

describe('createSqlProvider', () => {
  it('returns a fail-fast Null provider by default', async () => {
    const config = loadAiConfig(testEnv())
    const sql = createSqlProvider(config, deps, createProviderRegistry())
    await expect(sql.run({ name: 'anything', params: {} }, {} as never)).rejects.toBeInstanceOf(
      ConfigError,
    )
  })

  it('honors an override', async () => {
    const config = loadAiConfig(testEnv())
    const sql = createSqlProvider(config, deps, createProviderRegistry(), new FakeSql())
    const result = await sql.run({ name: 'x', params: {} }, {} as never)
    expect(result.rows).toEqual([])
  })
})

describe('createVectorProvider', () => {
  it('returns a fail-fast Null provider by default', async () => {
    const config = loadAiConfig(testEnv())
    const vector = createVectorProvider(config, deps, createProviderRegistry())
    await expect(vector.search({ text: 'q', topK: 1 }, {} as never)).rejects.toBeInstanceOf(
      ConfigError,
    )
  })

  it('honors an override', async () => {
    const config = loadAiConfig(testEnv())
    const vector = createVectorProvider(config, deps, createProviderRegistry(), new FakeVector())
    expect(await vector.search({ text: 'q', topK: 1 }, {} as never)).toEqual([])
  })
})
