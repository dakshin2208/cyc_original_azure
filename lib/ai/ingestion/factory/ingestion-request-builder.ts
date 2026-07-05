/**
 * @module lib/ai/ingestion/factory/ingestion-request-builder
 *
 * An immutable builder that assembles an {@link IngestionRequest} from a
 * {@link RawDocument} (Module 9). Pure DTO assembly — no ingestion logic. Each
 * `with*` returns a new builder.
 */

import type { ChunkingConfig } from '../chunking'
import type { RawDocument } from '../document'
import type { IngestionRequest, PreparationOptions } from '../pipeline'

/** Default chunking configuration applied when none is specified. */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'paragraph',
  maxTokens: null,
  maxChars: 1000,
  overlap: 0,
}

/** Default preparation options applied when none are specified. */
export const DEFAULT_PREPARATION_OPTIONS: PreparationOptions = {
  detectDuplicates: true,
  failOnValidationError: false,
}

/** Seed a default ingestion request from a raw document. */
function defaultRequest(document: RawDocument, createdAt: string): IngestionRequest {
  return {
    document,
    chunking: DEFAULT_CHUNKING_CONFIG,
    options: DEFAULT_PREPARATION_OPTIONS,
    createdAt,
  }
}

/** Immutable builder for {@link IngestionRequest}. */
export class IngestionRequestBuilder {
  private constructor(private readonly draft: IngestionRequest) {}

  /** Create a builder seeded with a raw document and a creation time. */
  static create(document: RawDocument, createdAt: string): IngestionRequestBuilder {
    return new IngestionRequestBuilder(defaultRequest(document, createdAt))
  }

  private with(patch: Partial<IngestionRequest>): IngestionRequestBuilder {
    return new IngestionRequestBuilder({ ...this.draft, ...patch })
  }

  /** Set the chunking configuration. */
  withChunking(chunking: ChunkingConfig): IngestionRequestBuilder {
    return this.with({ chunking })
  }

  /** Set the preparation options. */
  withOptions(options: PreparationOptions): IngestionRequestBuilder {
    return this.with({ options })
  }

  /** Produce the immutable {@link IngestionRequest}. */
  build(): IngestionRequest {
    return Object.freeze({ ...this.draft })
  }
}

/** Create an {@link IngestionRequestBuilder} seeded with a document and time. */
export function createIngestionRequestBuilder(
  document: RawDocument,
  createdAt: string,
): IngestionRequestBuilder {
  return IngestionRequestBuilder.create(document, createdAt)
}
