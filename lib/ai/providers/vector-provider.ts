/**
 * @module lib/ai/providers/vector-provider
 *
 * Provider factory for the {@link VectorIndexPort}. Mirrors the LLM/SQL
 * factories: selects a concrete vector store from configuration, defaults to a
 * fail-fast {@link NullVectorProvider}, and errors at boot when a selected
 * provider has no registered adapter. Concrete stores ship in later modules.
 */

import { ConfigError, type VectorIndexPort } from '@/lib/ai/shared'
import type { AiPlatformConfig } from '../config'
import { NullVectorProvider } from './null-providers'
import type { ProviderDeps, ProviderRegistry } from './provider-registry'

/**
 * Construct the {@link VectorIndexPort} for the configured provider.
 *
 * @param config   The platform configuration (selects the provider).
 * @param deps     Infrastructure (logger, clock) passed to the factory.
 * @param registry Registered provider factories.
 * @param override An explicit port to use instead (tests / future wiring).
 */
export function createVectorProvider(
  config: AiPlatformConfig,
  deps: ProviderDeps,
  registry: ProviderRegistry,
  override?: VectorIndexPort,
): VectorIndexPort {
  if (override) return override

  const name = config.vectorDb.provider
  if (name === 'none') return new NullVectorProvider()

  const factory = registry.getVector(name)
  if (!factory) {
    throw new ConfigError(
      `Vector provider "${name}" is selected but no adapter is registered. ` +
        `Register it on the ProviderRegistry before boot.`,
      { detail: { provider: name } },
    )
  }
  return factory(config, deps)
}
