/**
 * @module lib/ai/chat/__tests__/provider-config.test
 * Env-driven provider configuration + resolution (no SDK, no provider logic).
 */

import { describe, expect, it } from 'vitest'
import {
  createProviderRegistry,
  createStaticProvider,
} from '@/lib/ai/llm'
import { readProviderConfig, resolveProvider } from '@/lib/ai/chat'

describe('readProviderConfig', () => {
  it('selects a supported provider and reads its key + timeout', () => {
    const cfg = readProviderConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', AI_TIMEOUT_MS: '5000' })
    expect(cfg.name).toBe('openai')
    expect(cfg.apiKey).toBe('sk-x')
    expect(cfg.timeoutMs).toBe(5000)
  })

  it('maps each provider to its api-key env var', () => {
    expect(readProviderConfig({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' }).apiKey).toBe('k')
    expect(readProviderConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }).apiKey).toBe('g')
  })

  it('falls back to "none" for an unknown or missing provider', () => {
    expect(readProviderConfig({}).name).toBe('none')
    expect(readProviderConfig({ AI_PROVIDER: 'grok' }).name).toBe('none')
  })

  it('uses the default timeout when unset or invalid', () => {
    expect(readProviderConfig({}).timeoutMs).toBe(30_000)
    expect(readProviderConfig({ AI_TIMEOUT_MS: 'abc' }).timeoutMs).toBe(30_000)
  })
})

describe('resolveProvider', () => {
  it('resolves a registered provider by name', () => {
    const registry = createProviderRegistry([createStaticProvider('openai', '{}')])
    const provider = resolveProvider(readProviderConfig({ AI_PROVIDER: 'openai' }), registry)
    expect(provider.name).toBe('openai')
  })

  it('degrades to an unavailable provider when not registered', async () => {
    const provider = resolveProvider(readProviderConfig({ AI_PROVIDER: 'gemini' }), createProviderRegistry())
    expect(provider.name).toBe('gemini')
    await expect(provider.complete({ messages: [], responseFormat: 'json' })).rejects.toThrow()
  })

  it('degrades to unavailable when no provider is configured', async () => {
    const provider = resolveProvider(readProviderConfig({}))
    expect(provider.name).toBe('none')
    await expect(provider.complete({ messages: [], responseFormat: 'json' })).rejects.toThrow()
  })
})
