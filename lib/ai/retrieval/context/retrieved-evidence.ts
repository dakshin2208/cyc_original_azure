/**
 * @module lib/ai/retrieval/context/retrieved-evidence
 *
 * The atomic units of retrieved knowledge (Module 1). Each wraps a Sprint 3
 * {@link KnowledgeRecord} with its source, repository kind, and ranking — so
 * downstream reasoning gets fully-attributed, ranked evidence. Models only.
 */

import type { DocumentMetadata, KnowledgeRecord, KnowledgeSourceId } from '@/lib/ai/knowledge'
import type { EvidenceRanking } from '../ranking'
import type { RepositoryKind } from '../sources'

/**
 * A single piece of retrieved, attributed, ranked evidence.
 * @typeParam T The record content type.
 */
export interface RetrievedEvidence<T = unknown> {
  /** The underlying knowledge record. */
  readonly record: KnowledgeRecord<T>
  /** The source the record came from. */
  readonly sourceId: KnowledgeSourceId
  /** The kind of repository that produced it. */
  readonly repositoryKind: RepositoryKind
  /** The computed ranking for this evidence. */
  readonly ranking: EvidenceRanking
}

/** Retrieved evidence backed by a structured record. */
export type RetrievedRecord<T = unknown> = RetrievedEvidence<T>

/** Retrieved evidence backed by a document, carrying document metadata. */
export interface RetrievedDocument extends RetrievedEvidence<string> {
  /** Source-level document metadata. */
  readonly document: DocumentMetadata
}
