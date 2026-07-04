/**
 * @module lib/ai/query/extraction/entity-extractor
 *
 * The entity-extractor contract (Module 5). Interface only — no extraction
 * logic. Extraction may be intent-aware, so the (optional) classified intent is
 * part of the input.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { QueryEntity } from '../entities'
import type { QueryIntentType } from '../intent'

/** Input to entity extraction. */
export interface EntityExtractionInput {
  /** The raw (or pre-normalized) user text. */
  readonly text: string
  /** The already-classified intent, when available (enables intent-aware extraction). */
  readonly intent?: QueryIntentType
  /** BCP-47 language hint, when known. */
  readonly language?: string
}

/** Output of entity extraction. */
export interface EntityExtractionResult {
  /** The extracted entities (unnormalized or partially normalized). */
  readonly entities: readonly QueryEntity[]
}

/** Extracts structured entities from a natural-language query. */
export interface EntityExtractor {
  /**
   * Extract entities from a query.
   * @param input   The text, optional intent, and language hint.
   * @param context The current turn's request context.
   */
  extract(input: EntityExtractionInput, context: RequestContext): Promise<EntityExtractionResult>
}
