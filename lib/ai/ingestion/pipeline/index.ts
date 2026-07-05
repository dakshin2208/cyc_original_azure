/**
 * @module lib/ai/ingestion/pipeline
 * Barrel for pipeline contracts and the ingestion request (Module 6).
 */
export type { PreparationOptions, IngestionRequest } from './ingestion-request'
export type { PreparationStage, DocumentLoader, DocumentChunker } from './stages'
export type {
  KnowledgePreparationComponents,
  KnowledgePreparationPipeline,
} from './pipeline'
