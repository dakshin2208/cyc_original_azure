/**
 * @module lib/ai/query/model/structured-query
 *
 * The canonical structured query (Module 3) — the single artifact produced by
 * the Query Understanding Layer. Everything downstream consumes THIS and never
 * the raw user text. Fully immutable. Model only.
 */

import type { QueryConfidence } from '../confidence'
import type { QueryEntity } from '../entities'
import type { ClassifiedIntent } from '../intent'
import type { MissingInformation } from '../missing'
import type { QueryContext } from './query-context'
import type { QueryConstraint, QueryFilter } from './filters'
import type { QueryPriority } from './priority'
import type { RequestedOutput } from './requested-output'
import type { ValidationState } from './validation-state'

/**
 * The complete, source-agnostic representation of an understood user query.
 */
export interface StructuredQuery {
  /** The classified intent. */
  readonly intent: ClassifiedIntent
  /** Extracted, normalized entities. */
  readonly entities: readonly QueryEntity[]
  /** Narrowing filters derived from the query. */
  readonly filters: readonly QueryFilter[]
  /** Hard/soft constraints derived from the query. */
  readonly constraints: readonly QueryConstraint[]
  /** The kind of answer the user needs. */
  readonly requestedOutput: RequestedOutput
  /** Composed confidence for the understanding. */
  readonly confidence: QueryConfidence
  /** BCP-47 language the query was understood in. */
  readonly language: string
  /** The verbatim user text. */
  readonly originalQuery: string
  /** The normalized form of the user text. */
  readonly normalizedQuery: string
  /** Information required but not present. */
  readonly missingInformation: MissingInformation
  /** Stateless query context (no conversation history). */
  readonly context: QueryContext
  /** Processing priority hint. */
  readonly priority: QueryPriority
  /** Validation lifecycle state. */
  readonly validationState: ValidationState
}
