/**
 * @module lib/ai/query/intent/classified-intent
 *
 * The result of intent classification: the chosen intent plus scored
 * alternatives (for downstream disambiguation). Model only.
 */

import type { QueryIntentType } from './intent-type'

/** A candidate intent with its score. */
export interface IntentCandidate {
  /** The candidate intent. */
  readonly type: QueryIntentType
  /** Classification confidence in [0, 1]. */
  readonly confidence: number
}

/** The classified intent for a query, with ranked alternatives. */
export interface ClassifiedIntent {
  /** The selected (highest-confidence) intent. */
  readonly type: QueryIntentType
  /** Confidence of the selected intent in [0, 1]. */
  readonly confidence: number
  /** Other plausible intents, ranked by confidence (may be empty). */
  readonly alternatives: readonly IntentCandidate[]
}
