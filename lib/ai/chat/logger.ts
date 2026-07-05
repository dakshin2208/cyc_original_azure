/**
 * @module lib/ai/chat/logger
 *
 * Structured logging for the Chat API. A `ChatLogger` receives typed events
 * (request, provider, latency, validation, guard, fallback, response status). The
 * default logger emits one JSON line per event; a null logger is provided for
 * tests. It logs message LENGTH, never message CONTENT (privacy). No analytics.
 */

/** A single structured log event. */
export interface ChatLogEvent {
  readonly event: 'request' | 'orchestrated' | 'llm' | 'response' | 'error'
  readonly conversationId?: string | null
  readonly messageLength?: number
  readonly intent?: string
  readonly evidenceCount?: number
  readonly provider?: string
  /** LLM pipeline status (ok/repaired/unparseable/rejected/provider_error). */
  readonly llmStatus?: string
  readonly attempts?: number
  /** Number of validation/guard issues surfaced. */
  readonly issues?: number
  readonly guardRemoved?: number
  readonly fallback?: boolean
  readonly latencyMs?: number
  readonly httpStatus?: number
  readonly code?: string
}

/** Receives structured chat events. */
export interface ChatLogger {
  log(event: ChatLogEvent): void
}

/** A logger that emits one JSON line per event (default). */
export function createConsoleLogger(): ChatLogger {
  return Object.freeze({
    log: (event: ChatLogEvent): void => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ scope: 'chat', ...event }))
    },
  })
}

/** A logger that discards everything (tests / silent mode). */
export function createNullLogger(): ChatLogger {
  return Object.freeze({ log: () => undefined })
}

/** A logger that records events in memory (tests). */
export interface RecordingLogger extends ChatLogger {
  readonly events: readonly ChatLogEvent[]
}

/** Create an in-memory recording logger. */
export function createRecordingLogger(): RecordingLogger {
  const events: ChatLogEvent[] = []
  return Object.freeze({
    log: (event: ChatLogEvent) => void events.push(event),
    get events() {
      return events
    },
  })
}
