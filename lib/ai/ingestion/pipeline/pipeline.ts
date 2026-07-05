/**
 * @module lib/ai/ingestion/pipeline/pipeline
 *
 * The top-level preparation pipeline contract (Module 6): Load → Parse →
 * Normalize → Chunk → Validate → Prepare. Interface only — NO orchestration is
 * implemented this sprint. `KnowledgePreparationComponents` is the injected set
 * of stage implementations a future pipeline will compose.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { DocumentNormalizer } from '../normalization'
import type { ParserRegistry } from '../parsing'
import type { PreparationResult } from '../result'
import type { KnowledgePreparationValidator } from '../validation'
import type { IngestionRequest } from './ingestion-request'
import type { DocumentChunker, DocumentLoader } from './stages'

/** The injected stage implementations a pipeline composes. */
export interface KnowledgePreparationComponents {
  /** Load stage. */
  readonly loader: DocumentLoader
  /** Parse stage (resolves a parser per document type). */
  readonly parsers: ParserRegistry
  /** Normalize stage. */
  readonly normalizer: DocumentNormalizer
  /** Chunk stage. */
  readonly chunker: DocumentChunker
  /** Validate stage. */
  readonly validator: KnowledgePreparationValidator
}

/**
 * Prepares raw documents for retrieval by running the ingestion stages. Interface
 * only; the implementation (which composes the stages) is a future module.
 */
export interface KnowledgePreparationPipeline {
  /**
   * Prepare a document for retrieval.
   * @param request The ingestion request.
   * @param context The current request context.
   */
  prepare(request: IngestionRequest, context: RequestContext): Promise<PreparationResult>
}
