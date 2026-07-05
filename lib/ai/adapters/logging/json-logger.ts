/**
 * @module lib/ai/adapters/logging/json-logger
 *
 * Production {@link LoggerPort}: structured, single-line JSON logs with
 * correlation ids and PII redaction (Project Structure, doc 07 §13). Business
 * modules never call `console.*`; they log through this port.
 *
 * The output sink is injected (defaulting to stdout) so tests can capture output
 * without spying on globals, and the level threshold is honored per environment.
 */

import type { ClockPort, LogEvent, LoggerPort, LogLevel } from '@/lib/ai/shared'

/** A destination for a serialized log line. */
export type LogSink = (line: string) => void

/** Numeric severity ordering used for threshold filtering. */
const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 }

/** Keys whose values are redacted from structured log data. */
const REDACT_KEYS: ReadonlySet<string> = new Set([
  'apikey',
  'api_key',
  'anthropicapikey',
  'openaiapikey',
  'servicerolekey',
  'service_role_key',
  'password',
  'token',
  'secret',
  'authorization',
  'email',
  'phone',
  'phone_number',
])

/** Default sink: one JSON line per event to stdout. */
const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`)
}

/** Recursively redact sensitive values from a structured payload. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val)
    }
    return out
  }
  return value
}

/** Configuration for a {@link JsonLogger}. */
export interface JsonLoggerConfig {
  /** Minimum level to emit. */
  readonly level: LogLevel
  /** Whether to pretty-print (2-space) instead of compact JSON. */
  readonly pretty: boolean
}

/**
 * A structured JSON logger implementing {@link LoggerPort}. Use
 * {@link createJsonLogger} to construct one; {@link JsonLogger.child} returns a
 * logger with additional bindings merged into every event.
 */
export class JsonLogger implements LoggerPort {
  constructor(
    private readonly config: JsonLoggerConfig,
    private readonly clock: ClockPort,
    private readonly sink: LogSink,
    private readonly bindings: Readonly<Record<string, unknown>>,
  ) {}

  /** Log at `debug` severity. */
  debug(event: LogEvent): void {
    this.write('debug', event)
  }

  /** Log at `info` severity. */
  info(event: LogEvent): void {
    this.write('info', event)
  }

  /** Log at `warn` severity. */
  warn(event: LogEvent): void {
    this.write('warn', event)
  }

  /** Log at `error` severity. */
  error(event: LogEvent): void {
    this.write('error', event)
  }

  /** Return a child logger with `extra` bindings merged into every event. */
  child(extra: Readonly<Record<string, unknown>>): LoggerPort {
    return new JsonLogger(this.config, this.clock, this.sink, { ...this.bindings, ...extra })
  }

  private write(level: LogLevel, event: LogEvent): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.config.level]) return

    const record: Record<string, unknown> = {
      level,
      time: this.clock.isoNow(),
      message: event.message,
      ...this.bindings,
    }
    if (event.traceId) record.traceId = event.traceId
    if (event.data) record.data = redact(event.data)
    if (event.error !== undefined) record.error = serializeError(event.error)

    this.sink(this.config.pretty ? JSON.stringify(record, null, 2) : JSON.stringify(record))
  }
}

/** Reduce an unknown thrown value to a safe, serializable shape. */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const base: Record<string, unknown> = { name: error.name, message: error.message }
    // AiError exposes a JSON-safe `toJSON`; prefer it when present.
    const maybeJson = (error as { toJSON?: () => unknown }).toJSON
    if (typeof maybeJson === 'function') return { ...base, ...(maybeJson.call(error) as object) }
    return base
  }
  return { value: String(error) }
}

/**
 * Create a production {@link JsonLogger}.
 *
 * @param config Level and formatting.
 * @param clock  Time source for timestamps.
 * @param sink   Output destination (defaults to stdout).
 */
export function createJsonLogger(
  config: JsonLoggerConfig,
  clock: ClockPort,
  sink: LogSink = stdoutSink,
): LoggerPort {
  return new JsonLogger(config, clock, sink, {})
}
