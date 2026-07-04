/**
 * @module lib/ai/config/feature-flags
 *
 * Centralized feature-flag construction. Flags gate the wave rollout of AI
 * capabilities (AI Architecture doc 03; Project Structure doc 07 §14) and are
 * the single source of truth consumed everywhere via `ConfigPort.flags()`.
 *
 * Safe production defaults: capabilities that depend on unbuilt prerequisites
 * are OFF by default — RAG (no knowledge base yet) and memory (gated on the
 * PII/RLS governance fix).
 */

import type { AiFeatureFlags } from '@/lib/ai/shared'
import type { EnvReader } from './env'

/** Environment variable names backing each flag. */
export const FLAG_ENV = {
  rag: 'AI_FLAG_RAG_ENABLED',
  recommendation: 'AI_FLAG_RECOMMENDATION_ENABLED',
  comparison: 'AI_FLAG_COMPARISON_ENABLED',
  memory: 'AI_FLAG_MEMORY_ENABLED',
  reasoning: 'AI_FLAG_REASONING_ENABLED',
  streaming: 'AI_FLAG_STREAMING_ENABLED',
} as const

/** Default flag values applied when the corresponding variable is absent. */
export const FLAG_DEFAULTS: Readonly<Record<keyof typeof FLAG_ENV, boolean>> = {
  rag: false, // no curated knowledge base yet (doc 02 §8)
  recommendation: true,
  comparison: true,
  memory: false, // governance-gated on the PII/RLS fix (doc 01 §4)
  reasoning: true,
  streaming: true,
}

/**
 * Build the immutable {@link AiFeatureFlags} from environment.
 *
 * `telemetryEnabled` is intentionally *not* an independent flag: it mirrors the
 * telemetry configuration so there is a single source of truth for whether
 * telemetry is on.
 *
 * @param reader           An {@link EnvReader} bound to the env source.
 * @param telemetryEnabled The resolved telemetry-enabled value.
 */
export function buildFeatureFlags(reader: EnvReader, telemetryEnabled: boolean): AiFeatureFlags {
  return Object.freeze({
    ragEnabled: reader.bool(FLAG_ENV.rag, FLAG_DEFAULTS.rag),
    recommendationEnabled: reader.bool(FLAG_ENV.recommendation, FLAG_DEFAULTS.recommendation),
    comparisonEnabled: reader.bool(FLAG_ENV.comparison, FLAG_DEFAULTS.comparison),
    memoryEnabled: reader.bool(FLAG_ENV.memory, FLAG_DEFAULTS.memory),
    telemetryEnabled,
    reasoningEnabled: reader.bool(FLAG_ENV.reasoning, FLAG_DEFAULTS.reasoning),
    streamingEnabled: reader.bool(FLAG_ENV.streaming, FLAG_DEFAULTS.streaming),
  })
}
