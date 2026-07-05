/**
 * @module lib/ai/orchestration/models/entities
 * The extracted-entity DTO.
 */

import type { EntityType } from './enums'

/** A single entity deterministically extracted from a question. */
export interface ExtractedEntity {
  /** The kind of entity. */
  readonly type: EntityType
  /** The canonical value (name, code, or number). */
  readonly value: string | number
  /** The canonical/normalized string form. */
  readonly normalized: string
  /** The exact span matched in the (normalized) question. */
  readonly raw: string
  /** Extraction confidence in [0, 1] (1 = exact/lexicon match). */
  readonly confidence: number
}
