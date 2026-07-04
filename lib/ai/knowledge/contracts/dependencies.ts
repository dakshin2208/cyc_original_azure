/**
 * @module lib/ai/knowledge/contracts/dependencies
 *
 * The dependency bundle injected into repository builders. Sourced from the
 * Sprint 2 runtime container (`container.logger`, `.clock`, `.telemetry`) — the
 * Knowledge Access Layer never instantiates infrastructure itself
 * (Dependency Inversion). Interface only.
 */

import type { ClockPort, LoggerPort, TelemetryPort } from '@/lib/ai/shared'

/** Infrastructure ports available to every knowledge repository. */
export interface KnowledgeDependencies {
  /** Structured logger. */
  readonly logger: LoggerPort
  /** Time source. */
  readonly clock: ClockPort
  /** Tracing/metrics. */
  readonly telemetry: TelemetryPort
}
