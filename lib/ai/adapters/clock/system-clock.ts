/**
 * @module lib/ai/adapters/clock/system-clock
 *
 * Production {@link ClockPort} backed by the system clock. Injecting the clock
 * (rather than calling `Date` directly in the core) keeps time-dependent logic
 * deterministic and testable (Project Structure, doc 07 §9).
 */

import type { ClockPort } from '@/lib/ai/shared'

/** A {@link ClockPort} that reads the real system time. */
export class SystemClock implements ClockPort {
  /** The current instant. */
  now(): Date {
    return new Date()
  }

  /** The current instant as an ISO-8601 string. */
  isoNow(): string {
    return new Date().toISOString()
  }
}

/** Create a production system clock. */
export function createSystemClock(): ClockPort {
  return new SystemClock()
}
