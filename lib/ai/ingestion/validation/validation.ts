/**
 * @module lib/ai/ingestion/validation/validation
 *
 * Validation outcome models (Module 7): scoped validations for documents,
 * metadata, and chunks, plus the aggregate report. Models only — no validation
 * logic.
 */

import type { ChunkId, DocumentId } from '../document'
import type { PreparationIssue } from './issues'

/** The base outcome of a validation: a flag plus any issues found. */
export interface ValidationOutcome {
  /** `true` when there are no `error`-severity issues. */
  readonly valid: boolean
  /** All issues found (may be empty). */
  readonly issues: readonly PreparationIssue[]
}

/** Validation outcome for a prepared document. */
export interface DocumentValidation extends ValidationOutcome {
  /** Discriminator. */
  readonly scope: 'document'
  /** The validated document. */
  readonly documentId: DocumentId
}

/** Validation outcome for document metadata. */
export interface MetadataValidation extends ValidationOutcome {
  /** Discriminator. */
  readonly scope: 'metadata'
  /** The document whose metadata was validated. */
  readonly documentId: DocumentId
}

/** Validation outcome for a single chunk. */
export interface ChunkValidation extends ValidationOutcome {
  /** Discriminator. */
  readonly scope: 'chunk'
  /** The validated chunk. */
  readonly chunkId: ChunkId
}

/** Validation outcome for the overall preparation. */
export interface PreparationValidation extends ValidationOutcome {
  /** Discriminator. */
  readonly scope: 'preparation'
}

/** The aggregate validation report for a preparation operation. */
export interface PreparationValidationReport {
  /** Document-level validation. */
  readonly document: DocumentValidation
  /** Metadata validation. */
  readonly metadata: MetadataValidation
  /** Per-chunk validations. */
  readonly chunks: readonly ChunkValidation[]
  /** Overall rollup. */
  readonly overall: PreparationValidation
}
