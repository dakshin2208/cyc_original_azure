/**
 * @module lib/ai/knowledge/health/source-health
 *
 * Health report models for individual sources and the aggregate registry view.
 * Models only.
 */

import type { KnowledgeSourceId } from '../contracts/identifiers'
import type { HealthStatus } from './health-status'

/** A point-in-time health report for a single knowledge source. */
export interface SourceHealth {
  /** The source this report describes. */
  readonly sourceId: KnowledgeSourceId
  /** The observed status. */
  readonly status: HealthStatus
  /** ISO-8601 timestamp when the check was performed. */
  readonly checkedAt: string
  /** Optional human-readable detail (e.g. failure reason). */
  readonly message: string | null
  /** Optional observed latency in milliseconds. */
  readonly latencyMs: number | null
  /** Optional structured, non-sensitive diagnostic details. */
  readonly details: Readonly<Record<string, unknown>> | null
}

/** An aggregate health view across many sources. */
export interface HealthReport {
  /** The worst status across all sources (overall rollup). */
  readonly overall: HealthStatus
  /** Per-source health reports. */
  readonly sources: readonly SourceHealth[]
  /** ISO-8601 timestamp when the aggregate was produced. */
  readonly generatedAt: string
}
