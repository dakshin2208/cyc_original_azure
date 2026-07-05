/**
 * @module lib/ai/knowledge/metadata/knowledge-metadata
 *
 * Metadata models describing knowledge — at the source level
 * ({@link KnowledgeMetadata}, {@link DocumentMetadata}) and the record level
 * ({@link RecordMetadata}). Models only; nothing here extracts or computes them.
 */

import type { KnowledgeSourceId, KnowledgeSourceType } from '../contracts/identifiers'
import type { DocumentType, MimeType } from './document-types'
import type { SchemaDescriptor } from './schema'

/**
 * Source-level metadata: describes a whole knowledge source. Optional fields are
 * `null` (rather than absent) so a descriptor's shape is stable and explicit.
 */
export interface KnowledgeMetadata {
  /** The source this metadata describes. */
  readonly sourceId: KnowledgeSourceId
  /** The kind of source. */
  readonly sourceType: KnowledgeSourceType
  /** Source/content version identifier. */
  readonly version: string
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string
  /** ISO-8601 last-updated timestamp. */
  readonly updatedAt: string
  /** Content checksum/hash, when computable. */
  readonly checksum: string | null
  /** Owning team/system, when known. */
  readonly owner: string | null
  /** Structural schema, when the source is structured. */
  readonly schema: SchemaDescriptor | null
  /** Source-level confidence/trust in [0, 1], when applicable. */
  readonly confidence: number | null
  /** Primary content language (BCP-47), when known. */
  readonly language: string | null
  /** Approximate size in bytes, when known. */
  readonly sizeBytes: number | null
}

/** Source-level metadata specialized for document sources. */
export interface DocumentMetadata extends KnowledgeMetadata {
  /** The document type. */
  readonly documentType: DocumentType
  /** The document MIME type. */
  readonly mimeType: MimeType
  /** Document title, when known. */
  readonly title: string | null
  /** Page count for paginated documents, when known. */
  readonly pageCount: number | null
}

/** Record-level metadata attached to an individual knowledge record. */
export interface RecordMetadata {
  /** Confidence/trust for this record in [0, 1], when applicable. */
  readonly confidence: number | null
  /** Record language (BCP-47), when known. */
  readonly language: string | null
  /** Per-record checksum/hash, when computable. */
  readonly checksum: string | null
  /** Free-form classification tags. */
  readonly tags: readonly string[]
}
