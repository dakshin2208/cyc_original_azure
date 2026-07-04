/**
 * @module lib/ai/retrieval/sources/repository-kind
 *
 * The vocabulary of knowledge-source kinds the retrieval layer can target. Used
 * by the repository selector and carried on every piece of retrieved evidence.
 * Value list + derived union — a model, not logic.
 */

/** All repository kinds the retrieval layer understands (frozen). */
export const REPOSITORY_KINDS = [
  'college',
  'branch',
  'cutoff',
  'statistics',
  'fees',
  'document',
  'structured',
] as const

/** A single repository kind. */
export type RepositoryKind = (typeof REPOSITORY_KINDS)[number]
