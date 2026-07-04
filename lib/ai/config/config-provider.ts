/**
 * @module lib/ai/config/config-provider
 *
 * Adapts the full {@link AiPlatformConfig} to the shared {@link ConfigPort}.
 *
 * Deliberately narrow: `ConfigPort` exposes only the *safe* operational subset
 * (flags, default model tier, candidate-set cap). Secret-bearing sections
 * (`llm.anthropicApiKey`, `supabase.serviceRoleKey`, …) are intentionally not
 * reachable through this port, so business modules can never read secrets
 * (Project Structure, doc 07 §14).
 */

import type { AiConfig, AiFeatureFlags, ConfigPort } from '@/lib/ai/shared'
import type { AiPlatformConfig } from './platform-config'

/**
 * Create a {@link ConfigPort} that exposes only the safe subset of the platform
 * configuration.
 *
 * @param platform The full, validated platform configuration.
 */
export function createConfigProvider(platform: AiPlatformConfig): ConfigPort {
  const safe: AiConfig = Object.freeze({
    flags: platform.flags,
    defaultModelTier: platform.defaultModelTier,
    maxCandidateSet: platform.maxCandidateSet,
  })

  return Object.freeze({
    get(): AiConfig {
      return safe
    },
    flags(): AiFeatureFlags {
      return platform.flags
    },
  })
}
