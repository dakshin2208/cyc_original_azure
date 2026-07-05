/**
 * @module lib/ai/ingestion/document/prepared-document
 *
 * The prepared document model (Module 1) — normalized and ready for chunking.
 * Reuses the Sprint 3 {@link DocumentMetadata} (no duplication). Model only.
 */

import type { DocumentMetadata, DocumentType } from '@/lib/ai/knowledge'
import type { DocumentChecksum } from './checksum'
import type { DocumentId } from './identifiers'
import type { DocumentSection } from './parsed-document'
import type { DocumentVersion } from './version'

/** A document after parsing + normalization, ready to be chunked. */
export interface PreparedDocument {
  /** Document identifier. */
  readonly id: DocumentId
  /** The document type. */
  readonly documentType: DocumentType
  /** Normalized full text. */
  readonly normalizedText: string
  /** Normalized sections. */
  readonly sections: readonly DocumentSection[]
  /** Source-level metadata (reused Knowledge Access Layer model). */
  readonly metadata: DocumentMetadata
  /** Version information. */
  readonly version: DocumentVersion
  /** Content checksum. */
  readonly checksum: DocumentChecksum
  /** ISO-8601 timestamp when preparation completed. */
  readonly preparedAt: string
}
