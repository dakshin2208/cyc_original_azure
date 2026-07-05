/**
 * @module lib/ai/llm/__tests__/provider.test
 * Provider abstraction — function/static/unavailable providers (no SDK, no net).
 */

import { describe, expect, it } from 'vitest'
import {
  ProviderError,
  createFunctionProvider,
  createStaticProvider,
  createUnavailableProvider,
  type CompletionRequest,
} from '@/lib/ai/llm'

const REQUEST: CompletionRequest = { messages: [{ role: 'user', content: 'hi' }], responseFormat: 'json' }

describe('llm provider', () => {
  it('wraps a responder function and returns its completion', async () => {
    const p = createFunctionProvider('fn', (req) => ({ text: `saw ${req.messages.length} msg`, model: 'x' }))
    expect(p.name).toBe('fn')
    const r = await p.complete(REQUEST)
    expect(r.text).toBe('saw 1 msg')
    expect(r.model).toBe('x')
  })

  it('supports async responders', async () => {
    const p = createFunctionProvider('async', async () => ({ text: 'ok' }))
    expect((await p.complete(REQUEST)).text).toBe('ok')
  })

  it('rejects a non-string completion with ProviderError', async () => {
    const p = createFunctionProvider('bad', () => ({ text: 123 as unknown as string }))
    await expect(p.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
  })

  it('static provider always returns the same text', async () => {
    const p = createStaticProvider('static', '{"answer":"hi"}')
    expect((await p.complete(REQUEST)).text).toBe('{"answer":"hi"}')
  })

  it('unavailable provider always throws ProviderError', async () => {
    const p = createUnavailableProvider('down', 'boom')
    await expect(p.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
  })

  it('providers are swappable via the shared interface', async () => {
    const providers = [createStaticProvider('a', 'A'), createStaticProvider('b', 'B')]
    const texts = await Promise.all(providers.map((p) => p.complete(REQUEST).then((r) => r.text)))
    expect(texts).toEqual(['A', 'B'])
  })
})
