/**
 * @module lib/ai/query/classification/intent-classifier
 *
 * The intent-classifier contract (Module 4). Interface only — no model, prompt,
 * or classification logic. A future module will implement this; every
 * implementation receives the per-turn {@link RequestContext}.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { ClassifiedIntent } from '../intent'

/** Input to intent classification. */
export interface IntentClassificationInput {
  /** The raw (or pre-normalized) user text. */
  readonly text: string
  /** BCP-47 language hint, when known. */
  readonly language?: string
}

/** Output of intent classification. */
export interface IntentClassificationResult {
  /** The classified intent with alternatives. */
  readonly intent: ClassifiedIntent
}

/** Classifies the intent of a natural-language query. */
export interface IntentClassifier {
  /**
   * Classify a query's intent.
   * @param input   The text and language hint.
   * @param context The current turn's request context.
   */
  classify(
    input: IntentClassificationInput,
    context: RequestContext,
  ): Promise<IntentClassificationResult>
}
