/**
 * @module lib/ai/query/missing/missing-information
 *
 * Models describing information the query lacks (Module 8). A future
 * conversation engine will consume these to ask targeted follow-ups — this
 * sprint only models them. Models only.
 */

/** The kinds of information a college-counselor query may be missing. */
export const MISSING_FIELD_KINDS = [
  'cutoff',
  'rank',
  'marks',
  'community',
  'category',
  'branch',
  'college',
  'district',
  'year',
  'preference',
] as const

/** A single kind of missing information. */
export type MissingFieldKind = (typeof MISSING_FIELD_KINDS)[number]

/** A single missing piece of information. */
export interface MissingField {
  /** What is missing. */
  readonly kind: MissingFieldKind
  /** Whether this field is required for the intent to be answerable. */
  readonly required: boolean
  /** Why it is needed (for downstream explanation). */
  readonly reason: string
  /** A suggested clarifying question (data only; not generated here). */
  readonly prompt: string | null
}

/** The aggregate of what a query is missing. */
export interface MissingInformation {
  /** The missing fields (may be empty). */
  readonly fields: readonly MissingField[]
  /** Whether all *required* information is present. */
  readonly complete: boolean
}
