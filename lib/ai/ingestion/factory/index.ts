/**
 * @module lib/ai/ingestion/factory
 * Barrel for ingestion builders and factory (Module 9).
 */
export type { IngestionDependencies } from './dependencies'
export { ChunkBuilder, createChunkBuilder } from './chunk-builder'
export {
  IngestionRequestBuilder,
  createIngestionRequestBuilder,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_PREPARATION_OPTIONS,
} from './ingestion-request-builder'
export type { IngestionFactory } from './ingestion-factory'
export { createIngestionFactory } from './ingestion-factory'
