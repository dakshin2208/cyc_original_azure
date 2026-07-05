/**
 * @module lib/ai/ingestion/result/prepared-knowledge
 *
 * The prepared-knowledge aggregate (Module 8): a prepared document together with
 * its chunks — the unit that future retrieval will index/consume. Models only.
 */

import type { Chunk } from '../chunking'
import type { PreparedDocument } from '../document'

/** The chunks produced for a document, with light summary counts. */
export interface PreparedChunks {
  /** The chunks, in document order. */
  readonly items: readonly Chunk[]
  /** Number of chunks. */
  readonly count: number
  /** Total estimated tokens across the chunks. */
  readonly totalTokens: number
}

/** A fully prepared document plus its chunks. */
export interface PreparedKnowledge {
  /** The prepared document. */
  readonly document: PreparedDocument
  /** The prepared chunks. */
  readonly chunks: PreparedChunks
}
