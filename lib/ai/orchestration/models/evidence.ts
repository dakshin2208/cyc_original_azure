/**
 * @module lib/ai/orchestration/models/evidence
 * Evidence DTOs — the deduplicated, ranked, sourced facts a future LLM may cite.
 */

import type { ConfidenceLevel, EvidenceSource } from './enums'

/** A single, atomic, citable piece of evidence. */
export interface EvidenceItem {
  /** Stable deterministic id (source + college + label + value). */
  readonly id: string
  /** The college this fact is about, when applicable. */
  readonly collegeName: string | null
  /** The scoring/retrieval dimension this fact belongs to, when applicable. */
  readonly dimension: string | null
  /** Short human/machine label (e.g. "Median salary (INR/yr)"). */
  readonly label: string
  /** The concrete value, or `null` when the value is unavailable. */
  readonly value: string | number | null
  /** Which engine produced it. */
  readonly source: EvidenceSource
  /** Finer-grained origin (e.g. warehouse table `placement`). */
  readonly origin: string
  /** Confidence in [0, 1]. */
  readonly confidence: number
  /** Confidence band. */
  readonly confidenceLevel: ConfidenceLevel
}

/** The full, ranked evidence set for one query. */
export interface EvidencePackage {
  /** Evidence ranked most-to-least confident (stable). */
  readonly items: readonly EvidenceItem[]
  /** Count of items. */
  readonly count: number
  /** Item counts grouped by source. */
  readonly bySource: Readonly<Record<EvidenceSource, number>>
}

/** A citation the LLM must attach to any claim it makes (future response shape). */
export interface ResponseCitation {
  /** The {@link EvidenceItem.id} being cited. */
  readonly evidenceId: string
  readonly collegeName: string | null
  readonly label: string
  readonly source: EvidenceSource
}
