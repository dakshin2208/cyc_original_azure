/**
 * @module lib/ai/chat/provider-config
 *
 * Reads the LLM provider configuration from environment variables and resolves an
 * {@link LLMProvider} through the Sprint 5 provider interface. It is provider-
 * agnostic: it selects OPENAI / CLAUDE / GEMINI by NAME from an injected registry
 * and imports NO provider SDK. When the selected provider is not registered (no
 * SDK wired yet), it returns an "unavailable" provider so the pipeline degrades to
 * its safe fallback rather than crashing. No provider-specific logic leaks out.
 */

import {
  createProviderRegistry,
  createUnavailableProvider,
  type LLMProvider,
  type ProviderRegistry,
} from '@/lib/ai/llm'

/** Supported provider names (plus `none`). */
export type ProviderName = 'openai' | 'claude' | 'gemini' | 'none'

/** The resolved provider configuration. */
export interface ProviderConfig {
  readonly name: ProviderName
  /** API key for the selected provider, when present (never logged). */
  readonly apiKey: string | null
  /** Optional model id override. */
  readonly model: string | null
  /** Per-request timeout budget in milliseconds. */
  readonly timeoutMs: number
}

const API_KEY_ENV: Readonly<Record<Exclude<ProviderName, 'none'>, string>> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

const DEFAULT_TIMEOUT_MS = 30_000

type Env = Record<string, string | undefined>

/** Read the provider configuration from an environment map. */
export function readProviderConfig(env: Env): ProviderConfig {
  const raw = (env.AI_PROVIDER ?? 'none').trim().toLowerCase()
  const name: ProviderName = raw === 'openai' || raw === 'claude' || raw === 'gemini' ? raw : 'none'
  const apiKey = name === 'none' ? null : env[API_KEY_ENV[name]] ?? null
  const parsedTimeout = Number(env.AI_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS
  return { name, apiKey, model: env.AI_MODEL ?? null, timeoutMs }
}

/**
 * Resolve the provider instance for a config against a registry of available
 * providers. Falls back to an unavailable provider (never throws) so a
 * misconfigured or not-yet-wired provider degrades gracefully.
 */
export function resolveProvider(
  config: ProviderConfig,
  registry: ProviderRegistry = createProviderRegistry(),
): LLMProvider {
  if (config.name === 'none') {
    return createUnavailableProvider('none', 'no AI provider configured (set AI_PROVIDER)')
  }
  if (registry.has(config.name)) return registry.get(config.name)
  return createUnavailableProvider(config.name, `provider "${config.name}" is selected but not registered`)
}
