/**
 * @module lib/ai/llm/providers/__tests__/wiring.test
 * Env-driven provider wiring + the counselor system prompt.
 */

import { describe, expect, it } from 'vitest'
import {
  TN_COUNSELOR_SYSTEM,
  composeCounselorSystem,
  configuredProviderRegistry,
  readOpenAiConfig,
  resolveConfiguredProvider,
} from '@/lib/ai/llm'

describe('readOpenAiConfig', () => {
  it('returns null without a key (no accidental network path)', () => {
    expect(readOpenAiConfig({})).toBeNull()
  })

  it('reads key + applies model/base-url/timeout defaults and overrides', () => {
    const cfg = readOpenAiConfig({ OPENAI_API_KEY: 'sk', OPENAI_MODEL: 'gpt-4o', OPENAI_TIMEOUT_MS: '5000' })
    expect(cfg?.apiKey).toBe('sk')
    expect(cfg?.model).toBe('gpt-4o')
    expect(cfg?.baseUrl).toBe('https://api.openai.com/v1')
    expect(cfg?.timeoutMs).toBe(5000)
    expect(cfg?.temperature).toBe(0)
    expect(cfg?.isAzure).toBe(false) // public OpenAI by default (Bearer auth)
  })

  it('detects NATIVE Azure OpenAI from AZURE_OPENAI_ENDPOINT + api-version', () => {
    const cfg = readOpenAiConfig({
      OPENAI_API_KEY: 'k',
      AZURE_OPENAI_ENDPOINT: 'https://r.openai.azure.com/',
      OPENAI_MODEL: 'gpt-4.1',
    })
    expect(cfg?.isAzure).toBe(true)
    expect(cfg?.baseUrl).toBe('https://r.openai.azure.com') // trailing slash stripped
    expect(cfg?.model).toBe('gpt-4.1') // Azure deployment name
    expect(cfg?.apiVersion).toBe('2024-10-21') // default
    expect(
      readOpenAiConfig({ OPENAI_API_KEY: 'k', AZURE_OPENAI_ENDPOINT: 'https://r.openai.azure.com', OPENAI_API_VERSION: '2025-01-01-preview' })
        ?.apiVersion,
    ).toBe('2025-01-01-preview') // override honored
  })

  it('treats an azure-host OPENAI_BASE_URL as Azure too', () => {
    expect(readOpenAiConfig({ OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'https://r.openai.azure.com' })?.isAzure).toBe(true)
  })
})

describe('resolveConfiguredProvider', () => {
  it('resolves the OpenAI provider when a key is present', () => {
    expect(resolveConfiguredProvider({ OPENAI_API_KEY: 'sk' }).name).toBe('openai')
  })

  it('degrades to an unavailable provider without a key', async () => {
    const provider = resolveConfiguredProvider({})
    expect(provider.name).toBe('none')
    await expect(provider.complete({ messages: [], responseFormat: 'json' })).rejects.toThrow()
  })

  it('registers OpenAI in the configured registry only when keyed', () => {
    expect(configuredProviderRegistry({ OPENAI_API_KEY: 'sk' }).has('openai')).toBe(true)
    expect(configuredProviderRegistry({}).has('openai')).toBe(false)
  })
})

describe('TN counselor system prompt', () => {
  it('enforces the grounding + counseling policy', () => {
    const p = composeCounselorSystem().toLowerCase()
    expect(p).toBe(TN_COUNSELOR_SYSTEM.toLowerCase())
    expect(p).toMatch(/tamil nadu/)
    expect(p).toMatch(/never invent/)
    expect(p).toMatch(/only .*(supplied|evidence)/)
    expect(p).toContain("i don't have enough verified information")
    expect(p).toMatch(/compare/)
    expect(p).toMatch(/concise/)
    expect(p).toMatch(/citation/)
  })
})
