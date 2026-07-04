/**
 * @module lib/ai/ingestion/chunking/chunk-metadata
 *
 * Per-chunk metadata (Module 5). Model only.
 */

import type { ChunkId, DocumentId } from '../document'

/** Metadata describing a single chunk. */
export interface ChunkMetadata {
  /** The chunk's identifier. */
  readonly chunkId: ChunkId
  /** The parent document. */
  readonly parentDocumentId: DocumentId
  /** Zero-based order within the document. */
  readonly order: number
  /** Estimated token count. */
  readonly tokenCount: number
  /** Character count. */
  readonly charCount: number
  /** Source page, for paginated documents. */
  readonly sourcePage: number | null
  /** Owning section, when known. */
  readonly section: string | null
  /** Chunk title/heading, when known. */
  readonly title: string | null
  /** Confidence in the chunk's integrity in [0, 1], when applicable. */
  readonly confidence: number | null
  /** Chunk language (BCP-47), when known. */
  readonly language: string | null
}
