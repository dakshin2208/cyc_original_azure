/**
 * @module lib/ai/config
 *
 * Public barrel for the configuration layer. Import configuration types and the
 * loader from here; never read `process.env` outside this module.
 */

export type { EnvSource } from './env'
export { EnvReader } from './env'
export { LOG_LEVELS, MODEL_TIERS } from './constants'
export { FLAG_ENV, FLAG_DEFAULTS, buildFeatureFlags } from './feature-flags'
export type {
  AiPlatformConfig,
  LlmProviderConfig,
  LlmProviderName,
  SupabaseConfig,
  SqlProviderName,
  VectorDbConfig,
  VectorProviderName,
  LoggingConfig,
  TelemetryConfig,
} from './platform-config'
export { loadAiConfig } from './load-config'
export { createConfigProvider } from './config-provider'
