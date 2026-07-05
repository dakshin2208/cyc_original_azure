/**
 * @module lib/ai/ingestion/chunking/chunk
 *
 * The chunk model (Module 4) — an atomic unit of prepared knowledge. Model only.
 */

import type { DocumentId } from '../document'
import type { ChunkId } from '../document'
import type { ChunkMetadata } from './chunk-metadata'
import type { ChunkStrategy } from './chunk-strategy'

/** A single prepared chunk of a document. */
export interface Chunk {
  /** Chunk identifier. */
  readonly id: ChunkId
  /** The parent document. */
  readonly documentId: DocumentId
  /** The chunk text. */
  readonly text: string
  /** The strategy that produced it. */
  readonly strategy: ChunkStrategy
  /** Chunk metadata. */
  readonly metadata: ChunkMetadata
}
