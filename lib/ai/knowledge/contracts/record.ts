/**
 * @module lib/ai/knowledge/contracts/record
 *
 * The unit of knowledge returned by any repository — a source-agnostic record
 * wrapping typed content with record-level metadata. Interface only.
 */

import type { RecordMetadata } from '../metadata'
import type { KnowledgeRecordId, KnowledgeSourceId } from './identifiers'

/**
 * A single knowledge record. `content` is generic so a repository can return
 * rows, document chunks, JSON objects, etc., all behind the same shape.
 * @typeParam T The content type.
 */
export interface KnowledgeRecord<T = unknown> {
  /** Record identifier, unique within its source. */
  readonly id: KnowledgeRecordId
  /** The source this record came from. */
  readonly sourceId: KnowledgeSourceId
  /** The typed content payload. */
  readonly content: T
  /** Record-level metadata (confidence, language, tags, checksum). */
  readonly metadata: RecordMetadata
  /** ISO-8601 timestamp when the record was retrieved. */
  readonly retrievedAt: string
}
