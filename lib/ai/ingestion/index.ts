/**
 * @module lib/ai/ingestion
 *
 * Public API of the Document Ingestion & Knowledge Preparation Layer (Module 10).
 * The rest of the platform imports ingestion types and builders ONLY from here.
 *
 * This layer prepares raw knowledge (parse → normalize → chunk → validate) so
 * future retrieval can consume it. It does not embed, index, search, reason, or
 * generate answers.
 */

// ── Document models (Module 1) + reused knowledge metadata ───────────────────
export { CHECKSUM_ALGORITHMS } from './document'
export type {
  DocumentId,
  ChunkId,
  ChecksumAlgorithm,
  DocumentChecksum,
  DocumentVersion,
  DocumentSourceKind,
  DocumentSource,
  RawContent,
  RawDocument,
  DocumentSection,
  ParsedDocument,
  PreparedDocument,
  KnowledgeDocument,
  DocumentMetadata,
  DocumentType,
  MimeType,
} from './document'

// ── Parser contracts (Module 2) ──────────────────────────────────────────────
export type { DocumentParser, ParserRegistry } from './parsing'

// ── Normalization contracts (Module 3) ───────────────────────────────────────
export type {
  TextNormalizer,
  MetadataNormalizer,
  LanguageNormalizer,
  DuplicateDetector,
  DocumentNormalizer,
} from './normalization'

// ── Chunk models (Modules 4 & 5) ─────────────────────────────────────────────
export { CHUNK_STRATEGIES } from './chunking'
export type { ChunkStrategy, ChunkingConfig, ChunkMetadata, Chunk } from './chunking'

// ── Pipeline contracts (Module 6) ────────────────────────────────────────────
export type {
  PreparationOptions,
  IngestionRequest,
  PreparationStage,
  DocumentLoader,
  DocumentChunker,
  KnowledgePreparationComponents,
  KnowledgePreparationPipeline,
} from './pipeline'

// ── Validation models (Module 7) ─────────────────────────────────────────────
export { PREPARATION_ISSUE_CODES } from './validation'
export type {
  IngestionSeverity,
  PreparationIssueCode,
  PreparationIssue,
  ValidationOutcome,
  DocumentValidation,
  MetadataValidation,
  ChunkValidation,
  PreparationValidation,
  PreparationValidationReport,
  KnowledgePreparationValidator,
  IngestionErrorType,
} from './validation'
export {
  IngestionError,
  DocumentParseError,
  UnsupportedDocumentTypeError,
  DuplicateDocumentError,
} from './validation'

// ── Preparation result (Module 8) ────────────────────────────────────────────
export type {
  PreparationStatistics,
  PreparedChunks,
  PreparedKnowledge,
  PreparationStatus,
  PreparationResult,
} from './result'

// ── Factory / Builders (Module 9) ────────────────────────────────────────────
export type { IngestionDependencies, IngestionFactory } from './factory'
export {
  ChunkBuilder,
  createChunkBuilder,
  IngestionRequestBuilder,
  createIngestionRequestBuilder,
  createIngestionFactory,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_PREPARATION_OPTIONS,
} from './factory'
