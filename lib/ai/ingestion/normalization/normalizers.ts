/**
 * @module lib/ai/ingestion/normalization/normalizers
 *
 * Normalization contracts (Module 3). Interfaces only — no normalization logic.
 * These cover whitespace/encoding cleanup, metadata normalization, language
 * normalization, and duplicate-detection hooks. Future modules implement them.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { DocumentMetadata } from '@/lib/ai/knowledge'
import type {
  DocumentChecksum,
  ParsedDocument,
  PreparedDocument,
  RawDocument,
} from '../document'

/** Cleans document text (whitespace, control characters, encoding). */
export interface TextNormalizer {
  /** Normalize a block of text. */
  normalizeText(text: string): string
}

/** Normalizes document metadata to canonical form. */
export interface MetadataNormalizer {
  /** Normalize source-level metadata. */
  normalizeMetadata(metadata: DocumentMetadata): DocumentMetadata
}

/** Resolves/normalizes the language of document text. */
export interface LanguageNormalizer {
  /**
   * Determine the canonical BCP-47 language of text.
   * @param text The text to inspect.
   * @param hint An optional language hint.
   */
  normalizeLanguage(text: string, hint: string | null): string
}

/** Duplicate-detection hooks (fingerprint + membership check). No storage here. */
export interface DuplicateDetector {
  /** Compute a fingerprint for a raw document. */
  fingerprint(document: RawDocument): DocumentChecksum
  /** Whether a document with this checksum has been seen before. */
  isDuplicate(checksum: DocumentChecksum): boolean
}

/**
 * Composite normalizer that turns a {@link ParsedDocument} into a
 * {@link PreparedDocument}. Interface only.
 */
export interface DocumentNormalizer {
  /**
   * Normalize a parsed document into a prepared one.
   * @param parsed  The parsed document.
   * @param context The current request context.
   */
  normalize(parsed: ParsedDocument, context: RequestContext): Promise<PreparedDocument>
}
