/**
 * @module lib/ai/llm/__tests__/factory.test
 * Provider registry + adapter construction — swappable, no hardcoded provider.
 */

import { describe, expect, it } from 'vitest'
import {
  UnknownProviderError,
  createAdapterFor,
  createProviderRegistry,
  createStaticProvider,
} from '@/lib/ai/llm'
import { ask, goodReply, NAME } from './support'

describe('provider registry', () => {
  it('registers, resolves, and lists providers', () => {
    const registry = createProviderRegistry([createStaticProvider('alpha', 'A')])
    registry.register(createStaticProvider('beta', 'B'))
    expect(registry.has('alpha')).toBe(true)
    expect(registry.get('beta').name).toBe('beta')
    expect(registry.list()).toEqual(['alpha', 'beta'])
  })

  it('throws UnknownProviderError for an unregistered name', () => {
    const registry = createProviderRegistry()
    expect(() => registry.get('nope')).toThrow(UnknownProviderError)
  })

  it('lets a provider be replaced (swappable)', () => {
    const registry = createProviderRegistry([createStaticProvider('p', 'first')])
    registry.register(createStaticProvider('p', 'second'))
    expect(registry.list()).toEqual(['p'])
  })

  it('builds a working adapter over a named provider', async () => {
    const scenario = ask(`what are the placements at ${NAME.psg}`)
    const registry = createProviderRegistry([jsonReplyProvider(scenario)])
    const adapter = createAdapterFor(registry, 'stub')
    const result = await adapter.respond(scenario.prompt, scenario.context)
    expect(adapter.provider).toBe('stub')
    expect(result.status).toBe('ok')
  })
})

function jsonReplyProvider(scenario: ReturnType<typeof ask>) {
  return createStaticProvider('stub', JSON.stringify(goodReply(scenario.context)))
}
