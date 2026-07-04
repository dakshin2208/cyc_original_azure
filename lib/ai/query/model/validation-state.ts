/**
 * @module lib/ai/query/model/validation-state
 * The lifecycle state of a query's validation. Model only.
 */

/** Whether and how a structured query has been validated. */
export type ValidationState =
  /** Not yet validated. */
  | 'unvalidated'
  /** Validated and well-formed. */
  | 'valid'
  /** Validated and rejected. */
  | 'invalid'
  /** Well-formed but missing required information to answer. */
  | 'incomplete'
