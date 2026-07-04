/**
 * @module lib/ai/retrieval/strategy/retrieval-strategy
 *
 * Retrieval strategy models (Module 4). Describes *how* a repository is searched.
 * `vector` and `semantic` are reserved for future modules — they are named here
 * as model values ONLY; no embeddings, vector store, or semantic search is
 * implemented in this sprint. Models only.
 */

/** How a repository is searched. */
export const RETRIEVAL_STRATEGY_KINDS = [
  /** Lexical keyword matching. */
  'keyword',
  /** Matching over record metadata/fields. */
  'metadata',
  /** Exact-value lookup. */
  'exact_match',
  /** A combination of the above. */
  'hybrid',
  /** RESERVED — future vector similarity (not implemented this sprint). */
  'vector',
  /** RESERVED — future semantic search (not implemented this sprint). */
  'semantic',
] as const

/** A single retrieval strategy kind. */
export type RetrievalStrategyKind = (typeof RETRIEVAL_STRATEGY_KINDS)[number]

/** A selected retrieval strategy with optional description. */
export interface RetrievalStrategy {
  /** The strategy kind. */
  readonly kind: RetrievalStrategyKind
  /** Optional human-readable description. */
  readonly description: string | null
}
