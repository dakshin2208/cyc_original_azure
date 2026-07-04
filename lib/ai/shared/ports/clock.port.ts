/**
 * @module lib/ai/shared/ports/clock.port
 *
 * The time boundary. Injecting the clock keeps time-dependent logic
 * deterministic and testable (no ambient `Date.now()` in the core), and lets
 * tests freeze time (Project Structure, doc 07 §9).
 */

/** The clock port. Implementations provide the current time. */
export interface ClockPort {
  /** The current instant as a `Date`. */
  now(): Date
  /** The current instant as an ISO-8601 string. */
  isoNow(): string
}
