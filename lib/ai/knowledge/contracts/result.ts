/**
 * @module lib/ai/knowledge/contracts/result
 *
 * Query result and repository-result envelope. {@link RepositoryResult} reuses
 * the shared {@link Result} pattern with the knowledge error union, so fallible
 * repository operations carry failure in their type without throwing.
 */

import type { Result } from '@/lib/ai/shared'
import type { KnowledgeError } from './errors'
import type { KnowledgeSourceId } from './identifiers'
import type { KnowledgeRecord } from './record'

/**
 * The successful result of a query: the matched records plus retrieval metadata.
 * @typeParam T The record content type.
 */
export interface KnowledgeResult<T = unknown> {
  /** The matched records. */
  readonly records: readonly KnowledgeRecord<T>[]
  /** Total matches available (before pagination), when known. */
  readonly total: number | null
  /** The source that produced the result. */
  readonly sourceId: KnowledgeSourceId
  /** ISO-8601 timestamp when the result was produced. */
  readonly retrievedAt: string
  /** Whether the result was truncated by a limit. */
  readonly truncated: boolean
}

/**
 * The outcome of a repository operation: either the value or a
 * {@link KnowledgeError}. Reuses the shared {@link Result} envelope.
 * @typeParam T The success value type.
 */
export type RepositoryResult<T> = Result<T, KnowledgeError>
