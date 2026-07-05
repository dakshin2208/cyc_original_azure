/**
 * @module lib/ai/ingestion/document/checksum
 *
 * The document checksum value object (Module 1). Model only — no hashing is
 * implemented here.
 */

/** Supported checksum algorithms. */
export const CHECKSUM_ALGORITHMS = ['sha256', 'sha1', 'md5'] as const

/** A checksum algorithm identifier. */
export type ChecksumAlgorithm = (typeof CHECKSUM_ALGORITHMS)[number]

/** A content checksum: the algorithm and the resulting digest. */
export interface DocumentChecksum {
  /** The algorithm used. */
  readonly algorithm: ChecksumAlgorithm
  /** The hex-encoded digest value. */
  readonly value: string
}
