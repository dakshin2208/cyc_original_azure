/**
 * @module lib/ai/knowledge/documents/document-repository
 *
 * Document-flavored knowledge contracts (PDF, Markdown, JSON, CSV, HTML, text).
 * A {@link DocumentRepository} is a {@link KnowledgeRepository} whose records
 * carry document metadata. Interfaces only — no parsing/extraction is done here.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type {
  KnowledgeQuery,
  KnowledgeRecord,
  KnowledgeResult,
  RepositoryResult,
} from '../contracts'
import type { KnowledgeRepository } from '../contracts'
import type { DocumentMetadata, DocumentType } from '../metadata'

/** A document knowledge record. Content defaults to text. */
export interface DocumentRecord<T = string> extends KnowledgeRecord<T> {
  /** Source-level document metadata for this record's document. */
  readonly document: DocumentMetadata
}

/** A document-flavored query, optionally constrained to a document type. */
export interface DocumentQuery extends KnowledgeQuery {
  /** Restrict to a specific document type. */
  readonly documentType?: DocumentType
}

/** A repository backed by a document source. */
export interface DocumentRepository<T = string> extends KnowledgeRepository<T> {
  /**
   * Query documents of a given type.
   * @param type    The document type to restrict to.
   * @param query   The document query.
   * @param context The current turn's request context.
   */
  queryByType(
    type: DocumentType,
    query: DocumentQuery,
    context: RequestContext,
  ): Promise<RepositoryResult<KnowledgeResult<T>>>
}
