/**
 * @module lib/ai/providers/llm-provider
 *
 * Provider factory for the {@link LlmPort}. Selects a concrete provider from
 * configuration; supports swapping providers (Anthropic / OpenAI / Gemini / a
 * test fake) with no change to business logic (Provider Factory, doc 07 §14).
 *
 * Resolution rules:
 * - `provider: 'none'` → a {@link NullLlmProvider} (fails fast on use).
 * - a selected provider with a registered factory → that factory's instance.
 * - a selected provider with no registered factory → fail fast with
 *   {@link ConfigError} at boot (the adapter ships in a later module).
 */

import { ConfigError, type LlmPort } from '@/lib/ai/shared'
import type { AiPlatformConfig } from '../config'
import { NullLlmProvider } from './null-providers'
import type { ProviderDeps, ProviderRegistry } from './provider-registry'

/**
 * Construct the {@link LlmPort} for the configured provider.
 *
 * @param config   The platform configuration (selects the provider).
 * @param deps     Infrastructure (logger, clock) passed to the factory.
 * @param registry Registered provider factories.
 * @param override An explicit port to use instead (tests / future wiring).
 */
export function createLlmProvider(
  config: AiPlatformConfig,
  deps: ProviderDeps,
  registry: ProviderRegistry,
  override?: LlmPort,
): LlmPort {
  if (override) return override

  const name = config.llm.provider
  if (name === 'none') return new NullLlmProvider()

  const factory = registry.getLlm(name)
  if (!factory) {
    throw new ConfigError(
      `LLM provider "${name}" is selected but no adapter is registered. ` +
        `Register it on the ProviderRegistry before boot.`,
      { detail: { provider: name } },
    )
  }
  return factory(config, deps)
}
