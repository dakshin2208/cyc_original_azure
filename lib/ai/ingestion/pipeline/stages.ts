/**
 * @module lib/ai/ingestion/pipeline/stages
 *
 * Pipeline stage contracts (Module 6). A generic {@link PreparationStage} plus
 * the specific Load and Chunk stages. (Parse, Normalize, and Validate stages are
 * defined in their own modules and reused here.) Interfaces only.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { Chunk, ChunkingConfig } from '../chunking'
import type { DocumentSource, PreparedDocument, RawDocument } from '../document'

/**
 * A single, named preparation stage.
 * @typeParam TInput  Stage input.
 * @typeParam TOutput Stage output.
 */
export interface PreparationStage<TInput, TOutput> {
  /** Stage name (for observability). */
  readonly name: string
  /**
   * Execute the stage.
   * @param input   Stage input.
   * @param context The current request context.
   */
  execute(input: TInput, context: RequestContext): Promise<TOutput>
}

/** Load stage: fetches a {@link RawDocument} from a source. */
export interface DocumentLoader {
  /** Load a raw document from a source. */
  load(source: DocumentSource, context: RequestContext): Promise<RawDocument>
}

/** Chunk stage: splits a {@link PreparedDocument} into {@link Chunk}s. */
export interface DocumentChunker {
  /**
   * Chunk a prepared document.
   * @param document The prepared document.
   * @param config   The chunking configuration.
   * @param context  The current request context.
   */
  chunk(
    document: PreparedDocument,
    config: ChunkingConfig,
    context: RequestContext,
  ): Promise<readonly Chunk[]>
}
