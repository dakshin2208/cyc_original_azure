/**
 * @module lib/ai/providers/sql-provider
 *
 * Provider factory for the {@link SqlPort}. Mirrors {@link createLlmProvider}:
 * selects a concrete SQL provider from configuration, defaults to a fail-fast
 * {@link NullSqlProvider}, and errors at boot when a selected provider has no
 * registered adapter. The concrete Supabase adapter ships in a later module.
 */

import { ConfigError, type SqlPort } from '@/lib/ai/shared'
import type { AiPlatformConfig } from '../config'
import { NullSqlProvider } from './null-providers'
import type { ProviderDeps, ProviderRegistry } from './provider-registry'

/**
 * Construct the {@link SqlPort} for the configured provider.
 *
 * @param config   The platform configuration (selects the provider).
 * @param deps     Infrastructure (logger, clock) passed to the factory.
 * @param registry Registered provider factories.
 * @param override An explicit port to use instead (tests / future wiring).
 */
export function createSqlProvider(
  config: AiPlatformConfig,
  deps: ProviderDeps,
  registry: ProviderRegistry,
  override?: SqlPort,
): SqlPort {
  if (override) return override

  const name = config.supabase.provider
  if (name === 'none') return new NullSqlProvider()

  const factory = registry.getSql(name)
  if (!factory) {
    throw new ConfigError(
      `SQL provider "${name}" is selected but no adapter is registered. ` +
        `Register it on the ProviderRegistry before boot.`,
      { detail: { provider: name } },
    )
  }
  return factory(config, deps)
}
