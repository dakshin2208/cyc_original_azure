/**
 * @module lib/ai/llm/errors
 *
 * Error hierarchy for the LLM Integration Layer. These are thrown ONLY at the
 * provider boundary; the adapter catches them and converts them into a
 * deterministic {@link LLMResult} (it never lets an error escape). No AI.
 */

/** Machine-readable error codes. */
export type LLMErrorCode =
  | 'provider_error'
  | 'empty_completion'
  | 'parse_error'
  | 'validation_error'
  | 'unknown_provider'

/** Base error for the LLM layer. */
export class LLMError extends Error {
  readonly code: LLMErrorCode
  readonly detail?: Readonly<Record<string, unknown>>
  constructor(code: LLMErrorCode, message: string, detail?: Readonly<Record<string, unknown>>) {
    super(message)
    this.name = 'LLMError'
    this.code = code
    this.detail = detail
  }
}

/** A provider failed to produce a completion (network, auth, quota, …). */
export class ProviderError extends LLMError {
  constructor(message: string, detail?: Readonly<Record<string, unknown>>) {
    super('provider_error', message, detail)
    this.name = 'ProviderError'
  }
}

/** The provider returned text that could not be parsed into an AIResponse. */
export class ParseError extends LLMError {
  constructor(message: string, detail?: Readonly<Record<string, unknown>>) {
    super('parse_error', message, detail)
    this.name = 'ParseError'
  }
}

/** A requested provider is not registered. */
export class UnknownProviderError extends LLMError {
  constructor(name: string, available: readonly string[]) {
    super('unknown_provider', `No LLM provider registered under "${name}"`, { name, available })
    this.name = 'UnknownProviderError'
  }
}
