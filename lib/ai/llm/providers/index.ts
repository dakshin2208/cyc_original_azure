/**
 * @module lib/ai/llm/providers
 *
 * Concrete provider adapters + environment-driven wiring. This is the piece that
 * was previously missing: it builds a REAL {@link LLMProvider} from the
 * environment (currently OpenAI) and exposes it through the existing registry /
 * `LLMProvider` abstraction. No key is hardcoded; when none is configured it
 * resolves to an "unavailable" provider so the pipeline degrades to its
 * deterministic answer rather than failing. No chat-layer dependency.
 */

import { createProviderRegistry, type ProviderRegistry } from '../factory'
import { createUnavailableProvider, type LLMProvider } from '../provider'
import { createOpenAiProvider } from './openai/openai-provider'
import { readOpenAiConfig } from './openai/config'

export { type OpenAiConfig, readOpenAiConfig, OPENAI_ENV_VARS } from './openai/config'
export { type OpenAiProviderDeps, createOpenAiProvider } from './openai/openai-provider'

type Env = Record<string, string | undefined>

/**
 * Build a provider registry seeded with every provider the environment
 * configures (OpenAI when `OPENAI_API_KEY` is present). Extensible: add further
 * `register(...)` calls here as new provider adapters are implemented.
 */
export function configuredProviderRegistry(env: Env): ProviderRegistry {
  const registry = createProviderRegistry()
  const openai = readOpenAiConfig(env)
  if (openai) registry.register(createOpenAiProvider(openai))
  return registry
}

/**
 * Resolve the effective LLM provider for the environment: OpenAI when its key is
 * present, otherwise an "unavailable" provider (→ deterministic fallback).
 */
export function resolveConfiguredProvider(env: Env): LLMProvider {
  const openai = readOpenAiConfig(env)
  if (openai) return createOpenAiProvider(openai)
  return createUnavailableProvider('none', 'no LLM provider configured (set OPENAI_API_KEY to enable AI reasoning)')
}
