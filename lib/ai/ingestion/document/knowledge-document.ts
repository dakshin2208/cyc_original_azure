/**
 * @module lib/ai/ingestion/document/knowledge-document
 *
 * The canonical, stage-independent document identity/descriptor (Module 1). It
 * is the stable "what" being ingested, independent of the raw/parsed/prepared
 * representations. Model only.
 */

import type { DocumentMetadata, DocumentType } from '@/lib/ai/knowledge'
import type { DocumentChecksum } from './checksum'
import type { DocumentId } from './identifiers'
import type { DocumentVersion } from './version'

/** The canonical descriptor of an ingested document. */
export interface KnowledgeDocument {
  /** Document identifier. */
  readonly id: DocumentId
  /** Human-readable title. */
  readonly title: string
  /** The document type. */
  readonly documentType: DocumentType
  /** Source-level metadata (reused Knowledge Access Layer model). */
  readonly metadata: DocumentMetadata
  /** Version information. */
  readonly version: DocumentVersion
  /** Content checksum. */
  readonly checksum: DocumentChecksum
}
