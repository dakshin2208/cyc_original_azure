/**
 * @module lib/ai/knowledge/metadata/document-types
 *
 * Document classification aliases used by document metadata and the document
 * repository contracts. Metadata only — no parsing/extraction here.
 */

/** The logical type of a document source. */
export type DocumentType = 'pdf' | 'markdown' | 'json' | 'csv' | 'html' | 'text'

/**
 * An IANA media type string (e.g. `'application/pdf'`, `'text/markdown'`).
 * Kept as a string alias by design: the set of valid MIME types is open-ended.
 */
export type MimeType = string
