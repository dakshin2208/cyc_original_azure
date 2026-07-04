/**
 * @module lib/ai/query/model/filters
 *
 * Source-agnostic filter and constraint models derived from a query's entities.
 * A filter narrows results; a constraint is a condition that must hold (with a
 * `hard` flag distinguishing must-haves from preferences). Models only — no
 * evaluation logic here.
 */

/** Comparison operators for filters and constraints. */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

/** A narrowing criterion over a named field. */
export interface QueryFilter {
  /** Target field (canonical name). */
  readonly field: string
  /** Comparison operator. */
  readonly operator: FilterOperator
  /** Comparison value. */
  readonly value: unknown
}

/** A condition the answer must satisfy. `hard` distinguishes must-haves from preferences. */
export interface QueryConstraint extends QueryFilter {
  /** Whether the constraint is mandatory (`true`) or a soft preference (`false`). */
  readonly hard: boolean
}
