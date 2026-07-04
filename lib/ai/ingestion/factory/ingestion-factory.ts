/**
 * @module lib/ai/ingestion/factory/ingestion-factory
 *
 * The Ingestion Factory (Module 9): creates the immutable builders with injected
 * dependencies. No ingestion logic — it only constructs builders (Dependency
 * Injection).
 */

import type { ChunkStrategy } from '../chunking'
import type { ChunkId, DocumentId, RawDocument } from '../document'
import { ChunkBuilder, createChunkBuilder } from './chunk-builder'
import type { IngestionDependencies } from './dependencies'
import {
  createIngestionRequestBuilder,
  IngestionRequestBuilder,
} from './ingestion-request-builder'

/** Produces seeded ingestion builders. */
export interface IngestionFactory {
  /**
   * Create a request builder seeded with a raw document and the current time.
   * @param document The raw document to prepare.
   */
  newRequestBuilder(document: RawDocument): IngestionRequestBuilder

  /**
   * Create a chunk builder.
   * @param id         Chunk id.
   * @param documentId Parent document id.
   * @param text       Chunk text.
   * @param order      Zero-based order.
   * @param strategy   The strategy that produced the chunk.
   */
  newChunkBuilder(
    id: ChunkId,
    documentId: DocumentId,
    text: string,
    order: number,
    strategy: ChunkStrategy,
  ): ChunkBuilder
}

/**
 * Create an {@link IngestionFactory} bound to injected dependencies.
 * @param dependencies Infrastructure (clock) from the runtime container.
 */
export function createIngestionFactory(dependencies: IngestionDependencies): IngestionFactory {
  return Object.freeze({
    newRequestBuilder(document: RawDocument): IngestionRequestBuilder {
      return createIngestionRequestBuilder(document, dependencies.clock.isoNow())
    },
    newChunkBuilder(
      id: ChunkId,
      documentId: DocumentId,
      text: string,
      order: number,
      strategy: ChunkStrategy,
    ): ChunkBuilder {
      return createChunkBuilder(id, documentId, text, order, strategy)
    },
  })
}
