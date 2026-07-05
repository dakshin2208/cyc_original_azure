/**
 * @module lib/ai/ingestion/document/parsed-document
 *
 * The parsed document model (Module 1) — the structured output of a parser,
 * before normalization. Model only.
 */

import type { DocumentType } from '@/lib/ai/knowledge'
import type { DocumentChecksum } from './checksum'
import type { DocumentId } from './identifiers'

/** A logical section of a parsed document. */
export interface DocumentSection {
  /** Zero-based section order. */
  readonly order: number
  /** Section title/heading, when present. */
  readonly title: string | null
  /** Section text. */
  readonly text: string
  /** Source page, for paginated documents. */
  readonly page: number | null
}

/** A document after parsing: extracted text and structure. */
export interface ParsedDocument {
  /** Document identifier. */
  readonly id: DocumentId
  /** The resolved document type. */
  readonly documentType: DocumentType
  /** The full extracted text. */
  readonly text: string
  /** The parsed sections. */
  readonly sections: readonly DocumentSection[]
  /** Checksum carried through from the raw document. */
  readonly checksum: DocumentChecksum
  /** ISO-8601 timestamp when parsed. */
  readonly parsedAt: string
}
