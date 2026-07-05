/**
 * @module lib/ai/ingestion/validation/validator
 *
 * The preparation validator contract (Module 7). Interface only — no validation
 * logic. Takes the prepared document and chunks directly (not the aggregate
 * result) to keep this module independent of the result models.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { DocumentMetadata } from '@/lib/ai/knowledge'
import type { Chunk } from '../chunking'
import type { PreparedDocument } from '../document'
import type {
  ChunkValidation,
  DocumentValidation,
  MetadataValidation,
  PreparationValidation,
} from './validation'

/** Validates the products of knowledge preparation. */
export interface KnowledgePreparationValidator {
  /** Validate a prepared document. */
  validateDocument(document: PreparedDocument, context: RequestContext): DocumentValidation
  /** Validate document metadata. */
  validateMetadata(metadata: DocumentMetadata, context: RequestContext): MetadataValidation
  /** Validate a single chunk. */
  validateChunk(chunk: Chunk, context: RequestContext): ChunkValidation
  /** Validate the overall preparation of a document and its chunks. */
  validatePreparation(
    document: PreparedDocument,
    chunks: readonly Chunk[],
    context: RequestContext,
  ): PreparationValidation
}
