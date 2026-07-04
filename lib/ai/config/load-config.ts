/**
 * @module lib/ai/config/load-config
 *
 * The single entry point that reads, validates, and freezes the AI platform
 * configuration. This is the only place `process.env` is referenced (as the
 * default argument), satisfying "no `process.env` outside configuration"
 * (Project Structure, doc 07 §14).
 *
 * Validation is fail-fast and comprehensive: provider secrets are required only
 * when their provider is selected, and every problem is reported together via a
 * single {@link ConfigError}.
 */

import type { LogLevel, ModelTier } from '@/lib/ai/shared'
import { LOG_LEVELS, MODEL_TIERS } from './constants'
import { EnvReader, type EnvSource } from './env'
import { buildFeatureFlags } from './feature-flags'
import type {
  AiPlatformConfig,
  LlmProviderName,
  SqlProviderName,
  VectorProviderName,
} from './platform-config'

const LLM_PROVIDERS: readonly LlmProviderName[] = ['anthropic', 'openai', 'gemini', 'none']
const SQL_PROVIDERS: readonly SqlProviderName[] = ['supabase', 'none']
const VECTOR_PROVIDERS: readonly VectorProviderName[] = ['pinecone', 'pgvector', 'none']

/**
 * Load, validate, and freeze the complete {@link AiPlatformConfig}.
 *
 * @param env The environment source. Defaults to `process.env`; inject a plain
 *   object in tests to avoid touching global state.
 * @throws {@link ConfigError} when any required variable is missing or invalid;
 *   the error's `detail.issues` lists every problem found.
 */
export function loadAiConfig(env: EnvSource = process.env): AiPlatformConfig {
  const reader = new EnvReader(env)

  // ── LLM provider (secrets required only when selected) ─────────────────────
  const llmProvider = reader.enum<LlmProviderName>('AI_LLM_PROVIDER', LLM_PROVIDERS, 'none')
  const anthropicApiKey = reader.requiredWhen(llmProvider === 'anthropic', 'ANTHROPIC_API_KEY')
  const openaiApiKey = reader.requiredWhen(llmProvider === 'openai', 'OPENAI_API_KEY')
  const defaultTier = reader.enum<ModelTier>('AI_LLM_DEFAULT_TIER', MODEL_TIERS, 'balanced')

  // ── Structured data (Supabase) ─────────────────────────────────────────────
  const sqlProvider = reader.enum<SqlProviderName>('AI_SQL_PROVIDER', SQL_PROVIDERS, 'none')
  const supabaseSelected = sqlProvider === 'supabase'
  const supabaseUrl = reader.requiredWhen(supabaseSelected, 'NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = reader.requiredWhen(supabaseSelected, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = reader.requiredWhen(supabaseSelected, 'SUPABASE_SERVICE_ROLE_KEY')

  // ── Vector store ────────────────────────────────────────────────────────────
  const vectorProvider = reader.enum<VectorProviderName>(
    'AI_VECTOR_PROVIDER',
    VECTOR_PROVIDERS,
    'none',
  )
  const vectorRemote = vectorProvider === 'pinecone'
  const vectorUrl = reader.string('AI_VECTOR_URL')
  const vectorApiKey = reader.requiredWhen(vectorRemote, 'AI_VECTOR_API_KEY')
  const vectorIndexName = reader.string('AI_VECTOR_INDEX')

  // ── Logging ─────────────────────────────────────────────────────────────────
  const logLevel = reader.enum<LogLevel>('AI_LOG_LEVEL', LOG_LEVELS, 'info')
  const logPretty = reader.bool('AI_LOG_PRETTY', false)

  // ── Telemetry ────────────────────────────────────────────────────────────────
  const telemetryEnabled = reader.bool('AI_TELEMETRY_ENABLED', false)
  const telemetryServiceName = reader.string('AI_TELEMETRY_SERVICE_NAME', {
    fallback: 'cyc-ai-counselor',
  }) as string

  // ── Cross-cutting ─────────────────────────────────────────────────────────────
  const maxCandidateSet = reader.int('AI_MAX_CANDIDATE_SET', 500)

  // Flags depend on the resolved telemetry-enabled value (single source of truth).
  const flags = buildFeatureFlags(reader, telemetryEnabled)

  // Fail fast with the full list of problems before constructing the object.
  reader.done()

  return Object.freeze({
    flags,
    defaultModelTier: defaultTier,
    maxCandidateSet,
    llm: Object.freeze({
      provider: llmProvider,
      anthropicApiKey,
      openaiApiKey,
      defaultTier,
    }),
    supabase: Object.freeze({
      provider: sqlProvider,
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
    }),
    vectorDb: Object.freeze({
      provider: vectorProvider,
      url: vectorUrl,
      apiKey: vectorApiKey,
      indexName: vectorIndexName,
    }),
    logging: Object.freeze({ level: logLevel, pretty: logPretty }),
    telemetry: Object.freeze({ enabled: telemetryEnabled, serviceName: telemetryServiceName }),
  })
}
