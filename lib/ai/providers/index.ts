/**
 * @module lib/ai/providers
 *
 * Barrel for the provider layer: the registry, the fail-fast Null providers, and
 * the selection factories for the swappable LLM/SQL/Vector ports.
 */
export type {
  ProviderDeps,
  LlmProviderFactory,
  SqlProviderFactory,
  VectorProviderFactory,
} from './provider-registry'
export { ProviderRegistry, createProviderRegistry } from './provider-registry'
export { NullLlmProvider, NullSqlProvider, NullVectorProvider } from './null-providers'
export { createLlmProvider } from './llm-provider'
export { createSqlProvider } from './sql-provider'
export { createVectorProvider } from './vector-provider'
