/**
 * @module lib/ai/shared/ports/telemetry.port
 *
 * The observability boundary — tracing spans and metrics (AI Architecture,
 * doc 03 §20). Modules emit telemetry through this port; a backend adapter is
 * injected at the composition root.
 */

/** An active tracing span. Callers must `end()` it exactly once. */
export interface Span {
  /**
   * Attach a key/value attribute to the span.
   * @param key Attribute name.
   * @param value Attribute value.
   */
  setAttribute(key: string, value: string | number | boolean): void
  /**
   * Record an error against the span.
   * @param error The error to record.
   */
  recordError(error: unknown): void
  /** Finish the span. */
  end(): void
}

/**
 * The telemetry port. Implementations own trace export and metric aggregation.
 */
export interface TelemetryPort {
  /**
   * Start a span for a unit of work.
   * @param name Span name (e.g. `'reasoning.decide'`).
   * @param attributes Optional initial attributes.
   */
  startSpan(name: string, attributes?: Readonly<Record<string, string | number | boolean>>): Span

  /**
   * Record a metric sample.
   * @param name Metric name.
   * @param value Numeric value.
   * @param tags Optional dimensional tags.
   */
  metric(name: string, value: number, tags?: Readonly<Record<string, string>>): void
}
