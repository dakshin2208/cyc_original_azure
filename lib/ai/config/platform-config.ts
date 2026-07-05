/**
 * @module lib/ai/config/platform-config
 *
 * The strongly-typed, immutable configuration for the AI platform.
 *
 * `AiPlatformConfig` is the *full* internal configuration used only by the
 * composition root to construct adapters. Secret-bearing sections (API keys, DB
 * credentials) live here and are **never** exposed to business modules — those
 * receive only the safe subset via `ConfigPort` (the shared `AiConfig`). This
 * enforces the principle that business modules never see secrets
 * (Project Structure, doc 07 §14).
 */

import type { AiFeatureFlags, LogLevel, ModelTier } from '@/lib/ai/shared'

/** Selectable LLM providers. `'none'` means no provider is wired yet. */
export type LlmProviderName = 'anthropic' | 'openai' | 'gemini' | 'none'

/** Selectable structured-data providers. */
export type SqlProviderName = 'supabase' | 'none'

/** Selectable vector-store providers. */
export type VectorProviderName = 'pinecone' | 'pgvector' | 'none'

/** LLM provider configuration, including the (optional) provider secrets. */
export interface LlmProviderConfig {
  /** Which LLM provider to construct. */
  readonly provider: LlmProviderName
  /** Anthropic API key (required only when `provider === 'anthropic'`). */
  readonly anthropicApiKey: string | null
  /** OpenAI API key (reserved for future use). */
  readonly openaiApiKey: string | null
  /** Default model tier when a task does not specify one. */
  readonly defaultTier: ModelTier
}

/** Structured-data (Supabase) configuration. */
export interface SupabaseConfig {
  /** Whether a SQL provider is wired. */
  readonly provider: SqlProviderName
  /** Project URL (required when `provider === 'supabase'`). */
  readonly url: string | null
  /** Anonymous key. */
  readonly anonKey: string | null
  /** Service-role key (server-only; never exposed via ConfigPort). */
  readonly serviceRoleKey: string | null
}

/** Vector-store configuration. */
export interface VectorDbConfig {
  /** Which vector store to construct. */
  readonly provider: VectorProviderName
  /** Store endpoint URL, when applicable. */
  readonly url: string | null
  /** Store API key, when applicable. */
  readonly apiKey: string | null
  /** Index/collection name, when applicable. */
  readonly indexName: string | null
}

/** Logging configuration. */
export interface LoggingConfig {
  /** Minimum level to emit. */
  readonly level: LogLevel
  /** Whether to pretty-print (dev) instead of single-line JSON (prod). */
  readonly pretty: boolean
}

/** Telemetry configuration. */
export interface TelemetryConfig {
  /** Whether telemetry emission is enabled. */
  readonly enabled: boolean
  /** Service name reported to the telemetry backend. */
  readonly serviceName: string
}

/**
 * The complete, validated AI platform configuration. Constructed once at boot by
 * {@link loadAiConfig} and treated as immutable thereafter.
 */
export interface AiPlatformConfig {
  /** Feature flags (also surfaced via `ConfigPort`). */
  readonly flags: AiFeatureFlags
  /** Default model tier (also surfaced via `ConfigPort`). */
  readonly defaultModelTier: ModelTier
  /** Maximum candidate-set size the engines may consider (surfaced via `ConfigPort`). */
  readonly maxCandidateSet: number
  /** LLM provider configuration and secrets. */
  readonly llm: LlmProviderConfig
  /** Structured-data configuration and secrets. */
  readonly supabase: SupabaseConfig
  /** Vector-store configuration and secrets. */
  readonly vectorDb: VectorDbConfig
  /** Logging configuration. */
  readonly logging: LoggingConfig
  /** Telemetry configuration. */
  readonly telemetry: TelemetryConfig
}
