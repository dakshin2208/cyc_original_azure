/**
 * @module lib/ai/retrieval/factory
 * Barrel for the retrieval factory and request builder (Module 9).
 */
export type { RetrievalDependencies } from './dependencies'
export {
  RetrievalRequestBuilder,
  createRetrievalRequestBuilder,
  DEFAULT_RANKING_STRATEGY,
  DEFAULT_RETRIEVAL_STRATEGY,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
} from './retrieval-request-builder'
export type { RetrievalFactory } from './retrieval-factory'
export { createRetrievalFactory } from './retrieval-factory'
