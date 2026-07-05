/**
 * @module lib/ai/shared/contracts/knowledge
 *
 * The Knowledge engine's output — structured facts (SQL) and/or cited
 * explanations (RAG), plus disclosed gaps (AI Architecture, doc 03 §6).
 */

import type { GapToken } from '../enums'
import type { Passage, Provenance } from './evidence'

/**
 * A single labeled fact answering a factual lookup.
 * @typeParam T The value type (defaults to `unknown`).
 */
export interface FactItem<T = unknown> {
  /** Stable key (e.g. `'naac_grade'`). */
  readonly key: string
  /** Human-readable label. */
  readonly label: string
  /** The fact value. */
  readonly value: T
  /** Where the value came from. */
  readonly provenance: Provenance
}

/**
 * The Knowledge engine result: any structured facts, any explanatory passages,
 * and any gaps that made part of the question unanswerable.
 */
export interface KnowledgeResult {
  /** Structured facts (SQL path). */
  readonly facts: readonly FactItem[]
  /** Explanatory passages (RAG path). */
  readonly passages: readonly Passage[]
  /** Gaps encountered (e.g. `FEES`, `CALENDAR`). */
  readonly gaps: readonly GapToken[]
}
