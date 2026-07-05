/**
 * @module lib/ai/llm/response
 *
 * The LLM-layer result DTOs. `LLMResult` is the FINAL chat response the layer
 * returns: it ALWAYS carries a safe, valid {@link AIResponse} (the model's — after
 * validation + hallucination guard — or a deterministic fallback), plus the
 * status, the issues found, the attempt count, and the raw text for logging.
 */

import type { AIResponse } from '@/lib/ai/orchestration'

/** How the pipeline resolved one question. */
export type LLMResponseStatus =
  /** Model output parsed, validated, and needed no repair. */
  | 'ok'
  /** Valid, but the hallucination guard removed/replaced unsupported content. */
  | 'repaired'
  /** Model output could not be parsed after the retry → fallback returned. */
  | 'unparseable'
  /** Model invented information and was rejected after the retry → fallback returned. */
  | 'rejected'
  /** The provider itself failed → fallback returned. */
  | 'provider_error'

/** Severity of a validation/guard issue. */
export type IssueSeverity = 'error' | 'warning'

/** A single issue found while parsing, validating, or guarding a response. */
export interface ResponseIssue {
  readonly code: string
  readonly message: string
  readonly severity: IssueSeverity
}

/** The final, always-safe result of the LLM pipeline. */
export interface LLMResult {
  readonly status: LLMResponseStatus
  /** A guaranteed-valid response (validated + guarded, or the safe fallback). */
  readonly response: AIResponse
  /** Everything noticed along the way (rejections, repairs, provider errors). */
  readonly issues: readonly ResponseIssue[]
  /** How many provider attempts were made (1 = no retry). */
  readonly attempts: number
  /** The raw provider text of the last attempt, or `null` on provider error. */
  readonly raw: string | null
  /** The provider that produced (or failed to produce) the result. */
  readonly provider: string
}

/** Was this a clean, model-authored answer (not a fallback)? */
export function isModelAuthored(result: LLMResult): boolean {
  return result.status === 'ok' || result.status === 'repaired'
}
