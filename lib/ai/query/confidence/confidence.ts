/**
 * @module lib/ai/query/confidence/confidence
 *
 * Confidence models for query understanding (Module 9). Reuses the shared
 * {@link ConfidenceLevel} band so confidence is expressed consistently across
 * the platform. Models only — scoring logic is a future concern.
 */

import type { ConfidenceLevel } from '@/lib/ai/shared'
import type { EntityType } from '../entities'

/** Confidence in the classified intent. */
export interface IntentConfidence {
  /** Numeric score in [0, 1]. */
  readonly score: number
  /** Human-facing band derived from `score`. */
  readonly level: ConfidenceLevel
}

/** Confidence in a single extracted entity. */
export interface EntityConfidence {
  /** The entity type this confidence refers to. */
  readonly entityType: EntityType
  /** Numeric score in [0, 1]. */
  readonly score: number
  /** Human-facing band. */
  readonly level: ConfidenceLevel
}

/** The composed confidence for a whole structured query. */
export interface QueryConfidence {
  /** Intent-classification confidence in [0, 1]. */
  readonly intent: number
  /** Aggregate entity-extraction confidence in [0, 1]. */
  readonly entities: number
  /** Overall query-understanding confidence in [0, 1]. */
  readonly overall: number
  /** Human-facing band derived from `overall`. */
  readonly level: ConfidenceLevel
}
