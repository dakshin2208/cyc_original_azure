/**
 * @module lib/ai/ingestion/factory/chunk-builder
 *
 * An immutable builder that assembles a {@link Chunk} (Module 9). Pure DTO
 * assembly — it performs no chunking. Character count is derived from the text;
 * token count and positional metadata are set via `with*`. Each `with*` returns a
 * new builder.
 */

import type { Chunk, ChunkMetadata, ChunkStrategy } from '../chunking'
import type { ChunkId, DocumentId } from '../document'

/** Seed a default chunk from its identity, text, order, and strategy. */
function defaultChunk(
  id: ChunkId,
  documentId: DocumentId,
  text: string,
  order: number,
  strategy: ChunkStrategy,
): Chunk {
  const metadata: ChunkMetadata = {
    chunkId: id,
    parentDocumentId: documentId,
    order,
    tokenCount: 0,
    charCount: text.length,
    sourcePage: null,
    section: null,
    title: null,
    confidence: null,
    language: null,
  }
  return { id, documentId, text, strategy, metadata }
}

/** Immutable builder for {@link Chunk}. */
export class ChunkBuilder {
  private constructor(private readonly draft: Chunk) {}

  /** Create a chunk builder. */
  static create(
    id: ChunkId,
    documentId: DocumentId,
    text: string,
    order: number,
    strategy: ChunkStrategy,
  ): ChunkBuilder {
    return new ChunkBuilder(defaultChunk(id, documentId, text, order, strategy))
  }

  private withMetadata(patch: Partial<ChunkMetadata>): ChunkBuilder {
    return new ChunkBuilder({ ...this.draft, metadata: { ...this.draft.metadata, ...patch } })
  }

  /** Replace the chunk text (recomputes character count). */
  withText(text: string): ChunkBuilder {
    return new ChunkBuilder({
      ...this.draft,
      text,
      metadata: { ...this.draft.metadata, charCount: text.length },
    })
  }

  /** Set the estimated token count. */
  withTokenCount(tokenCount: number): ChunkBuilder {
    return this.withMetadata({ tokenCount })
  }

  /** Set the source page. */
  withSourcePage(sourcePage: number | null): ChunkBuilder {
    return this.withMetadata({ sourcePage })
  }

  /** Set the owning section. */
  withSection(section: string | null): ChunkBuilder {
    return this.withMetadata({ section })
  }

  /** Set the chunk title. */
  withTitle(title: string | null): ChunkBuilder {
    return this.withMetadata({ title })
  }

  /** Set the chunk confidence. */
  withConfidence(confidence: number | null): ChunkBuilder {
    return this.withMetadata({ confidence })
  }

  /** Set the chunk language. */
  withLanguage(language: string | null): ChunkBuilder {
    return this.withMetadata({ language })
  }

  /** Produce the immutable {@link Chunk}. */
  build(): Chunk {
    return Object.freeze({ ...this.draft, metadata: Object.freeze({ ...this.draft.metadata }) })
  }
}

/** Create a {@link ChunkBuilder}. */
export function createChunkBuilder(
  id: ChunkId,
  documentId: DocumentId,
  text: string,
  order: number,
  strategy: ChunkStrategy,
): ChunkBuilder {
  return ChunkBuilder.create(id, documentId, text, order, strategy)
}
