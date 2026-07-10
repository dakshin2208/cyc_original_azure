/**
 * @module lib/ai
 *
 * Public entry point for the AI platform. Exposes the platform configuration
 * types; the live counselor path is reached via the sub-barrels
 * `@/lib/ai/chat`, `@/lib/ai/llm`, and `@/lib/ai/orchestration`.
 *
 * Shared contracts remain available from `@/lib/ai/shared`.
 */

export type { AiPlatformConfig } from './config'
export { loadAiConfig } from './config'
