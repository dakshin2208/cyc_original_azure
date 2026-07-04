/**
 * @module lib/ai/ingestion/result/statistics
 * Statistics for a preparation operation (Module 8). Model only.
 */

/** Aggregate statistics produced by preparing a document. */
export interface PreparationStatistics {
  /** Number of documents processed (typically 1 per request). */
  readonly documentsProcessed: number
  /** Number of chunks produced. */
  readonly chunksProduced: number
  /** Total estimated tokens across all chunks. */
  readonly totalTokens: number
  /** Total characters across all chunks. */
  readonly totalChars: number
  /** Wall-clock duration in milliseconds. */
  readonly durationMs: number
}
