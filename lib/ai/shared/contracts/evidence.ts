/**
 * @module lib/ai/shared/contracts/evidence
 *
 * Grounding primitives. Every fact or passage the reasoning process consumes is
 * wrapped with provenance so answers can cite their sources and abstain when
 * evidence is missing (AI Architecture, doc 03 §18; Reasoning Engine, doc 05 §3).
 *
 * These types are produced by the Retrieval facade and consumed by every engine
 * and the Reasoning module.
 */

import type { GapToken } from '../enums'

/** Which retrieval surface a piece of evidence came from. */
export type SourceKind = 'sql' | 'rag' | 'computed'

/** A concrete reference to where a value or passage originated. */
export interface SourceRef {
  /** The retrieval surface. */
  readonly kind: SourceKind
  /** Table, named query, document id, or computation name. */
  readonly name: string
  /** Data vintage (e.g. academic year, `asOf` date) when known. */
  readonly vintage?: string | null
}

/** Trust metadata attached to every retrieved fact or passage. */
export interface Provenance {
  /** Where the value came from. */
  readonly source: SourceRef
  /** Confidence in this specific value, in the range [0, 1]. */
  readonly confidence: number
  /** ISO-8601 timestamp of retrieval. */
  readonly retrievedAt: string
}

/**
 * A single structured fact with provenance.
 * @typeParam T The value type (defaults to `unknown`).
 */
export interface EvidenceItem<T = unknown> {
  /** Stable key identifying the fact (e.g. `'median_salary'`). */
  readonly key: string
  /** The retrieved value. */
  readonly value: T
  /** Where the value came from and how trusted it is. */
  readonly provenance: Provenance
  /** Whether the value was neutral-imputed rather than observed. */
  readonly imputed: boolean
}

/** An unstructured text passage (RAG) with provenance. */
export interface Passage {
  /** The passage text. */
  readonly text: string
  /** Where the passage came from. */
  readonly provenance: Provenance
}

/** A citable reference surfaced to the user. */
export interface Citation {
  /** Human-readable label for the source. */
  readonly label: string
  /** The underlying source reference. */
  readonly source: SourceRef
  /** Optional link, when the source is externally addressable. */
  readonly url?: string | null
}

/**
 * A normalized bundle of everything retrieved for a reasoning step: structured
 * items, unstructured passages, and the knowledge gaps encountered.
 */
export interface EvidenceBundle {
  /** Structured facts. */
  readonly items: readonly EvidenceItem[]
  /** Unstructured passages. */
  readonly passages: readonly Passage[]
  /** Structural gaps encountered while gathering (disclosed, never hidden). */
  readonly gaps: readonly GapToken[]
}
