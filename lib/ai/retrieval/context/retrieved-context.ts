/**
 * @module lib/ai/retrieval/context/retrieved-context
 *
 * The primary output of the Knowledge Retrieval Layer (Module 1): the ranked,
 * attributed evidence gathered for a query, plus the metadata describing how it
 * was gathered. This is the artifact a future reasoning engine consumes. Model only.
 */

import type { RetrievalMetadata } from './retrieval-metadata'
import type { RetrievedEvidence } from './retrieved-evidence'

/** The knowledge gathered for a single structured query. */
export interface RetrievedContext {
  /** All retrieved evidence, typically ranked best-first. */
  readonly evidence: readonly RetrievedEvidence[]
  /** How the context was produced. */
  readonly metadata: RetrievalMetadata
}
