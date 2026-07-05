/**
 * @module lib/ai/query/factory/understanding
 *
 * The producer contract for the Query Understanding Layer. `QueryUnderstanding`
 * is the interface a FUTURE module will implement to turn raw text into a
 * {@link StructuredQuery}; `QueryUnderstandingComponents` is the set of injected
 * pipeline parts it will compose.
 *
 * Interfaces only — no pipeline is orchestrated here (that is explicitly out of
 * scope for this sprint). Defining the seam lets downstream layers depend on the
 * output contract without depending on any implementation.
 */

import type { RequestContext, TurnId } from '@/lib/ai/shared'
import type { IntentClassifier } from '../classification'
import type { EntityExtractor } from '../extraction'
import type { StructuredQuery } from '../model'
import type { QueryNormalizer } from '../normalization'
import type { QueryValidator, ValidationResult } from '../validation'

/** Raw input to query understanding — the only place raw text enters the layer. */
export interface RawQueryInput {
  /** The verbatim user text. */
  readonly text: string
  /** BCP-47 language hint, when known. */
  readonly language?: string
  /** The owning request turn, when applicable. */
  readonly turnId?: TurnId
}

/** The output of query understanding: the structured query and its validation. */
export interface QueryUnderstandingResult {
  /** The produced structured query. */
  readonly query: StructuredQuery
  /** The validation outcome for the query. */
  readonly validation: ValidationResult
}

/** The injected pipeline parts a {@link QueryUnderstanding} implementation composes. */
export interface QueryUnderstandingComponents {
  /** Classifies intent. */
  readonly classifier: IntentClassifier
  /** Extracts entities. */
  readonly extractor: EntityExtractor
  /** Normalizes text and entity aliases. */
  readonly normalizer: QueryNormalizer
  /** Validates the assembled query. */
  readonly validator: QueryValidator
}

/**
 * Transforms raw natural-language text into a validated {@link StructuredQuery}.
 * This is the single entry point downstream layers will use; they never receive
 * raw user text. Interface only — the implementation is a future sprint.
 */
export interface QueryUnderstanding {
  /**
   * Understand a raw query, producing a structured, validated result.
   * @param input   The raw text and hints.
   * @param context The current turn's request context.
   */
  understand(input: RawQueryInput, context: RequestContext): Promise<QueryUnderstandingResult>
}
