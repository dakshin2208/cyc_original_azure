/**
 * @module lib/ai/shared/ports/config.port
 *
 * The configuration boundary. Modules read validated, typed config through this
 * port (never `process.env` directly), so configuration is centralized, schema-
 * validated at boot, and swappable in tests (Project Structure, doc 07 §14).
 */

import type { ModelTier } from './llm.port'

/**
 * Feature flags gating the wave rollout of AI capabilities. Centrally owned by
 * the configuration layer and read by every module through {@link ConfigPort}.
 */
export interface AiFeatureFlags {
  /** Whether the RAG layer is active (off until the KB is authored). */
  readonly ragEnabled: boolean
  /** Whether the recommendation engine is exposed. */
  readonly recommendationEnabled: boolean
  /** Whether the comparison engine is exposed. */
  readonly comparisonEnabled: boolean
  /** Whether memory/personalization is active (gated on the PII/RLS fix). */
  readonly memoryEnabled: boolean
  /** Whether telemetry emission is active. */
  readonly telemetryEnabled: boolean
  /** Whether the reasoning pipeline is active. */
  readonly reasoningEnabled: boolean
  /** Whether streaming responses are enabled. */
  readonly streamingEnabled: boolean
}

/** The validated, typed AI configuration. */
export interface AiConfig {
  /** Feature flags. */
  readonly flags: AiFeatureFlags
  /** The default model tier when a task does not specify one. */
  readonly defaultModelTier: ModelTier
  /** The maximum candidate-set size the engines may consider. */
  readonly maxCandidateSet: number
}

/**
 * The configuration port. Implementations load and validate configuration once
 * at boot and expose it immutably.
 */
export interface ConfigPort {
  /** The full validated configuration. */
  get(): AiConfig
  /** Shortcut to the feature flags. */
  flags(): AiFeatureFlags
}
