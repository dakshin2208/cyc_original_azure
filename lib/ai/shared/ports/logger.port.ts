/**
 * @module lib/ai/shared/ports/logger.port
 *
 * The structured-logging boundary. Modules log through this port (never
 * `console.*`), so output stays structured, correlated by `traceId`, and
 * PII-redacted by the adapter (Project Structure, doc 07 §13).
 */

import type { TraceId } from '../ids'

/** Severity levels, in ascending order. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** A single structured log event. */
export interface LogEvent {
  /** Human-readable message. */
  readonly message: string
  /** Correlation id for the current turn, when available. */
  readonly traceId?: TraceId
  /** Structured, non-sensitive context. */
  readonly data?: Readonly<Record<string, unknown>>
  /** An associated error, when logging a failure. */
  readonly error?: unknown
}

/**
 * The logging port. Implementations serialize events, enforce PII redaction, and
 * respect environment-configured levels. `child` returns a logger with the given
 * bindings merged into every event (e.g. a per-turn logger bound to `traceId`).
 */
export interface LoggerPort {
  /** Log at `debug` severity. */
  debug(event: LogEvent): void
  /** Log at `info` severity. */
  info(event: LogEvent): void
  /** Log at `warn` severity. */
  warn(event: LogEvent): void
  /** Log at `error` severity. */
  error(event: LogEvent): void
  /**
   * Create a child logger with fixed bindings merged into every event.
   * @param bindings Context merged into all events from the child.
   */
  child(bindings: Readonly<Record<string, unknown>>): LoggerPort
}
