/**
 * @module lib/ai
 *
 * Public entry point for the AI platform. Application code boots the platform
 * via `createAiApplication()` and depends on the resulting {@link AiContainer};
 * it should not import adapters, providers, or config internals directly.
 *
 * Shared contracts remain available from `@/lib/ai/shared`.
 */

export {
  createAiApplication,
  type AiApplication,
  type AiApplicationOptions,
  type AiApplicationOverrides,
  type AiContainer,
  type RequestContextInput,
} from './runtime'

export { ProviderRegistry, createProviderRegistry } from './providers'
export type {
  ProviderDeps,
  LlmProviderFactory,
  SqlProviderFactory,
  VectorProviderFactory,
} from './providers'

export type { AiPlatformConfig } from './config'
export { loadAiConfig } from './config'
