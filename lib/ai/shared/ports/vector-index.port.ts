/**
 * @module lib/ai/shared/ports/vector-index.port
 *
 * The vector-store boundary for the RAG layer (AI Architecture, doc 03 §11).
 * Modules depend on this interface; a concrete store adapter is injected at the
 * composition root, so the store can be swapped without touching callers.
 */

import type { RequestContext } from '../contracts/request-context'

/** A semantic search request against the knowledge-base index. */
export interface VectorQuery {
  /** The query text. */
  readonly text: string
  /** Number of matches to return. */
  readonly topK: number
  /** Optional metadata filter (e.g. `{ docType: 'policy' }`). */
  readonly filter?: Readonly<Record<string, unknown>>
}

/** A single semantic-search match. */
export interface VectorMatch {
  /** Document/chunk id. */
  readonly id: string
  /** Similarity score. */
  readonly score: number
  /** The matched text. */
  readonly text: string
  /** Associated metadata (source, vintage, doc type). */
  readonly metadata: Readonly<Record<string, unknown>>
}

/** A document/chunk to be indexed. */
export interface VectorDocument {
  /** Stable document/chunk id. */
  readonly id: string
  /** The text to embed and index. */
  readonly text: string
  /** Associated metadata. */
  readonly metadata: Readonly<Record<string, unknown>>
}

/**
 * The vector-index port. Implementations own embedding, indexing, and retrieval.
 */
export interface VectorIndexPort {
  /**
   * Retrieve the most similar documents to a query.
   * @param query The semantic query.
   * @param context The current turn's request context.
   */
  search(query: VectorQuery, context: RequestContext): Promise<readonly VectorMatch[]>

  /**
   * Insert or update documents in the index.
   * @param documents The documents to upsert.
   */
  upsert(documents: readonly VectorDocument[]): Promise<void>
}
