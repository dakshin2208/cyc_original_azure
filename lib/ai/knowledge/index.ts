/**
 * @module lib/ai/knowledge
 *
 * Public API of the Knowledge Access Layer. The rest of the AI platform imports
 * knowledge types and the access facade ONLY from here — it must never know
 * whether a record came from SQL, a document, a vector store, a cache, or an API.
 *
 * Everything below is a re-export of an internal module's public surface; the
 * internals themselves are not part of the public contract.
 */

// ── Core contracts ───────────────────────────────────────────────────────────
export type {
  KnowledgeSourceId,
  KnowledgeRecordId,
  KnowledgeSourceType,
  KnowledgeSource,
  KnowledgeRecord,
  SortDirection,
  SortSpec,
  KnowledgeFilter,
  Pagination,
  KnowledgeQuery,
  KnowledgeResult,
  RepositoryResult,
  KnowledgeDependencies,
  KnowledgeRepository,
  KnowledgeError,
} from './contracts'
export {
  SourceNotFoundError,
  SourceAlreadyRegisteredError,
  SourceUnavailableError,
  RepositoryError,
  QueryError,
} from './contracts'

// ── Metadata models ──────────────────────────────────────────────────────────
export type {
  FieldType,
  SchemaField,
  SchemaDescriptor,
  DocumentType,
  MimeType,
  KnowledgeMetadata,
  DocumentMetadata,
  RecordMetadata,
} from './metadata'

// ── Health ───────────────────────────────────────────────────────────────────
export type { HealthStatus, SourceHealth, HealthReport, HealthCheck } from './health'

// ── SQL-flavored contracts ───────────────────────────────────────────────────
export type {
  SqlRow,
  SqlKnowledgeRecord,
  SqlQueryParams,
  SqlQuery,
  SqlRepository,
} from './sql'

// ── Document-flavored contracts ──────────────────────────────────────────────
export type { DocumentRecord, DocumentQuery, DocumentRepository } from './documents'

// ── Repository pattern (placeholders, builder, factory) ──────────────────────
export type {
  VectorRepository,
  CacheRepository,
  RepositoryBuilder,
  RepositoryFactory,
} from './repositories'
export { createRepositoryFactory } from './repositories'

// ── Registry & composition entry point ───────────────────────────────────────
export type { KnowledgeRegistry, KnowledgeAccess } from './registry'
export { createKnowledgeRegistry, createKnowledgeAccess } from './registry'
