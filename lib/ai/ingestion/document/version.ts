/**
 * @module lib/ai/ingestion/document/version
 *
 * The document version value object (Module 1). Richer than a bare version
 * string: it tracks revision lineage. Model only.
 */

/** Versioning information for a document. */
export interface DocumentVersion {
  /** Human-readable version label (e.g. semantic version or date). */
  readonly version: string
  /** Monotonic revision number. */
  readonly revision: number
  /** ISO-8601 timestamp when this version was created. */
  readonly createdAt: string
  /** The version id this one supersedes, or `null` for the first. */
  readonly supersedes: string | null
}
