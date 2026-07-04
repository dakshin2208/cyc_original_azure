/**
 * @module lib/ai/ingestion/document/identifiers
 *
 * Identifier aliases for the ingestion layer. Kept dependency-free (a leaf).
 */

/** Opaque identifier of an ingested document. */
export type DocumentId = string

/** Opaque identifier of a chunk within a document. */
export type ChunkId = string
