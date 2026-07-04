/**
 * @module lib/ai/runtime
 *
 * Barrel for the runtime/bootstrapping layer: the container, the per-turn
 * request-context factory, and the single composition root.
 */
export type { AiContainer, ContainerDeps } from './container'
export { createContainer } from './container'
export type { RequestContextInput, IdGenerator } from './request-context'
export { createRequestContext, defaultIdGenerator } from './request-context'
export type {
  AiApplication,
  AiApplicationOptions,
  AiApplicationOverrides,
} from './composition-root'
export { createAiApplication } from './composition-root'
