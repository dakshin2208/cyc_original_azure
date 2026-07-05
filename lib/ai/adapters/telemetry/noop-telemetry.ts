/**
 * @module lib/ai/adapters/telemetry/noop-telemetry
 *
 * A no-op {@link TelemetryPort}. It fully implements the port contract while
 * doing nothing, so the platform can run without a tracing/metrics backend and
 * be swapped for an OpenTelemetry adapter later with no call-site changes
 * (AI Architecture, doc 03 §20). This is a real Null Object, not a placeholder.
 */

import type { Span, TelemetryPort } from '@/lib/ai/shared'

/** A span that records nothing. */
class NoopSpan implements Span {
  setAttribute(_key: string, _value: string | number | boolean): void {
    // intentionally empty — no backend
  }

  recordError(_error: unknown): void {
    // intentionally empty — no backend
  }

  end(): void {
    // intentionally empty — no backend
  }
}

/** A {@link TelemetryPort} that discards all spans and metrics. */
export class NoopTelemetry implements TelemetryPort {
  private static readonly SPAN = new NoopSpan()

  startSpan(_name: string, _attributes?: Readonly<Record<string, string | number | boolean>>): Span {
    return NoopTelemetry.SPAN
  }

  metric(_name: string, _value: number, _tags?: Readonly<Record<string, string>>): void {
    // intentionally empty — no backend
  }
}

/** Create a no-op telemetry adapter (OpenTelemetry-ready seam). */
export function createNoopTelemetry(): TelemetryPort {
  return new NoopTelemetry()
}
