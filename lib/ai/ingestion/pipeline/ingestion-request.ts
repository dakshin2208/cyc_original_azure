/**
 * @module lib/ai/ingestion/pipeline/ingestion-request
 *
 * The canonical input to the preparation pipeline. Immutable model.
 */

import type { ChunkingConfig } from '../chunking'
import type { RawDocument } from '../document'

/** Options controlling a preparation run. */
export interface PreparationOptions {
  /** Whether to run duplicate detection. */
  readonly detectDuplicates: boolean
  /** Whether an error-severity validation issue rejects the whole preparation. */
  readonly failOnValidationError: boolean
}

/** A self-contained request to prepare one document for retrieval. */
export interface IngestionRequest {
  /** The raw document to prepare. */
  readonly document: RawDocument
  /** How to chunk the document. */
  readonly chunking: ChunkingConfig
  /** Preparation options. */
  readonly options: PreparationOptions
  /** ISO-8601 timestamp when the request was created. */
  readonly createdAt: string
}
