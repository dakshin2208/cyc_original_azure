/**
 * @module lib/ai/ingestion/document/raw-document
 *
 * The raw, pre-parse document model (Module 1). Content is a serializable
 * discriminated union (text or base64 binary) — no Node `Buffer`/stream types,
 * keeping the model pure and portable. Model only.
 */

import type { MimeType } from '@/lib/ai/knowledge'
import type { DocumentChecksum } from './checksum'
import type { DocumentId } from './identifiers'

/** Where a raw document originated. */
export type DocumentSourceKind = 'upload' | 'url' | 'filesystem' | 'inline'

/** A reference to a raw document's origin. */
export interface DocumentSource {
  /** The kind of source. */
  readonly kind: DocumentSourceKind
  /** The source URI/path, when applicable. */
  readonly uri: string | null
  /** A human-readable label, when applicable. */
  readonly label: string | null
}

/** Serializable raw content: inline text or base64-encoded binary. */
export type RawContent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'binary'; readonly base64: string }

/** A raw document as received, before parsing. */
export interface RawDocument {
  /** Document identifier. */
  readonly id: DocumentId
  /** Where it came from. */
  readonly source: DocumentSource
  /** Declared MIME type. */
  readonly mimeType: MimeType
  /** The raw content. */
  readonly content: RawContent
  /** Content checksum. */
  readonly checksum: DocumentChecksum
  /** Size in bytes. */
  readonly sizeBytes: number
  /** ISO-8601 timestamp when received. */
  readonly receivedAt: string
}
