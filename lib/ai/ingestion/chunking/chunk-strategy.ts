/**
 * @module lib/ai/ingestion/chunking/chunk-strategy
 *
 * Chunking strategy models (Module 4). `semantic` is reserved for a future
 * module and is named as a model value ONLY — no embeddings or semantic logic is
 * implemented this sprint. Models only.
 */

/** How a document is split into chunks. */
export const CHUNK_STRATEGIES = [
  /** Fixed-size chunks by character/token budget. */
  'fixed',
  /** One chunk per paragraph. */
  'paragraph',
  /** One chunk per sentence. */
  'sentence',
  /** RESERVED — future semantic chunking (not implemented this sprint). */
  'semantic',
  /** Overlapping fixed windows. */
  'sliding_window',
] as const

/** A single chunking strategy. */
export type ChunkStrategy = (typeof CHUNK_STRATEGIES)[number]

/** Configuration for a chunking operation. */
export interface ChunkingConfig {
  /** The strategy to apply. */
  readonly strategy: ChunkStrategy
  /** Maximum tokens per chunk, or `null` for unbounded. */
  readonly maxTokens: number | null
  /** Maximum characters per chunk, or `null` for unbounded. */
  readonly maxChars: number | null
  /** Overlap (characters) between adjacent chunks (for sliding window). */
  readonly overlap: number
}
