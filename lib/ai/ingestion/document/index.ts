/**
 * @module lib/ai/ingestion/document
 * Barrel for document models (Module 1). Re-exports the reused Knowledge Access
 * Layer document metadata/type models so all document contracts are reachable
 * from one place (reuse, not duplication).
 */
export type { DocumentId, ChunkId } from './identifiers'
export { CHECKSUM_ALGORITHMS } from './checksum'
export type { ChecksumAlgorithm, DocumentChecksum } from './checksum'
export type { DocumentVersion } from './version'
export type {
  DocumentSourceKind,
  DocumentSource,
  RawContent,
  RawDocument,
} from './raw-document'
export type { DocumentSection, ParsedDocument } from './parsed-document'
export type { PreparedDocument } from './prepared-document'
export type { KnowledgeDocument } from './knowledge-document'

// Reused from the Knowledge Access Layer (Sprint 3) — not redefined.
export type { DocumentMetadata, DocumentType, MimeType } from '@/lib/ai/knowledge'
