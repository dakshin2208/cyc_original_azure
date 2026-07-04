/**
 * @module lib/ai/query/model/requested-output
 *
 * Models the *kind of answer* the user needs (the "Need" in the examples:
 * opinion, comparison, prediction, explanation, …). This decouples what was
 * asked (intent) from the shape of the expected response. Model only.
 */

/** The kind of output a query requests. */
export const OUTPUT_KINDS = [
  /** A recommendation / judgment. */
  'opinion',
  /** A side-by-side comparison. */
  'comparison',
  /** A predicted outcome (e.g. eligibility). */
  'prediction',
  /** A factual explanation/definition. */
  'explanation',
  /** A list of matching items (search/discovery). */
  'list',
  /** A single-value factual lookup. */
  'lookup',
  /** The needed output could not be determined. */
  'unknown',
] as const

/** The kind of output a query requests. */
export type OutputKind = (typeof OUTPUT_KINDS)[number]

/** Describes the response shape the query expects. */
export interface RequestedOutput {
  /** The kind of output. */
  readonly kind: OutputKind
  /** Optional free-text elaboration of what is wanted. */
  readonly description: string | null
}
