/**
 * @module lib/ai/knowledge/health/health-status
 *
 * The health status vocabulary for knowledge sources. Interface/vocabulary only;
 * active monitoring (polling, scheduling, alerting) is out of scope.
 */

/** The health state of a knowledge source. */
export type HealthStatus =
  /** Fully operational. */
  | 'healthy'
  /** Operational but impaired (partial data, elevated latency). */
  | 'degraded'
  /** Not currently reachable/usable. */
  | 'unavailable'
  /** Starting up / warming; not yet ready. */
  | 'initializing'
  /** Status could not be determined. */
  | 'unknown'
