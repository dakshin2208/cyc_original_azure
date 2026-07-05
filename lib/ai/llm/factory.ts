/**
 * @module lib/ai/llm/factory
 *
 * Construction + provider selection for the LLM layer. A {@link ProviderRegistry}
 * holds swappable providers by name; {@link createAdapterFor} builds an adapter
 * over the selected one. NO provider is hardcoded or imported here — callers
 * register whichever providers they have (a future OpenAI/Claude/Gemini provider,
 * or a `createFunctionProvider` seam). No AI, no SDK.
 */

import type { AdapterConfig, LLMAdapter } from './adapter'
import { createLLMAdapter } from './adapter'
import { UnknownProviderError } from './errors'
import type { LLMProvider } from './provider'

/** A swappable registry of named providers. */
export interface ProviderRegistry {
  /** Register (or replace) a provider under its `name`. */
  register(provider: LLMProvider): void
  /** Get a provider by name, or throw {@link UnknownProviderError}. */
  get(name: string): LLMProvider
  has(name: string): boolean
  /** Registered provider names, sorted. */
  list(): readonly string[]
}

/** Create a provider registry, optionally seeded with providers. */
export function createProviderRegistry(seed: readonly LLMProvider[] = []): ProviderRegistry {
  const providers = new Map<string, LLMProvider>()
  for (const p of seed) providers.set(p.name, p)
  return Object.freeze({
    register: (provider) => void providers.set(provider.name, provider),
    get: (name) => {
      const p = providers.get(name)
      if (!p) throw new UnknownProviderError(name, [...providers.keys()].sort())
      return p
    },
    has: (name) => providers.has(name),
    list: () => [...providers.keys()].sort(),
  })
}

/** Build an adapter over a specific provider instance. */
export function createAdapter(provider: LLMProvider, config?: Partial<AdapterConfig>): LLMAdapter {
  return createLLMAdapter(provider, config)
}

/** Build an adapter over a named provider resolved from a registry. */
export function createAdapterFor(
  registry: ProviderRegistry,
  providerName: string,
  config?: Partial<AdapterConfig>,
): LLMAdapter {
  return createLLMAdapter(registry.get(providerName), config)
}
