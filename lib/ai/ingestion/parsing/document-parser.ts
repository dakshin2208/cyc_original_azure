/**
 * @module lib/ai/ingestion/parsing/document-parser
 *
 * Parser contracts (Module 2). Interfaces only — no parsing is implemented.
 * Concrete parsers for PDF/CSV/JSON/TXT/Markdown/Excel are future modules that
 * implement {@link DocumentParser} and register with a {@link ParserRegistry}.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { DocumentType, ParsedDocument, RawDocument } from '../document'

/** Parses a raw document into a structured {@link ParsedDocument}. */
export interface DocumentParser {
  /** The document types this parser can handle. */
  readonly supportedTypes: readonly DocumentType[]

  /** Whether this parser supports the given document type. */
  supports(documentType: DocumentType): boolean

  /**
   * Parse a raw document.
   * @param raw     The raw document.
   * @param context The current request context.
   */
  parse(raw: RawDocument, context: RequestContext): Promise<ParsedDocument>
}

/** Resolves a {@link DocumentParser} for a document type (Open/Closed extension). */
export interface ParserRegistry {
  /** Register a parser (future implementations plug in without code changes). */
  register(parser: DocumentParser): void
  /** Resolve a parser for a document type, or `null` if none is registered. */
  resolve(documentType: DocumentType): DocumentParser | null
}
