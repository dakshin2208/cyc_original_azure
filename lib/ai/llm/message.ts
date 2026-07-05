/**
 * @module lib/ai/llm/message
 *
 * The provider-agnostic request/response at the LLM boundary. A `CompletionRequest`
 * is what every provider (OpenAI/Claude/Gemini/…) receives; a `CompletionResult`
 * is what it returns. Reuses the neutral {@link PromptMessage} role vocabulary from
 * Sprint 4 so no provider-specific message shape leaks in. Pure data; no AI.
 */

import type { PromptMessage, PromptPackage } from '@/lib/ai/orchestration'

export type { PromptMessage }

/** Tuning knobs a caller may pass through to any provider. */
export interface CompletionOptions {
  /** Sampling temperature (default 0 for deterministic explanations). */
  readonly temperature?: number
  /** Optional max output tokens. */
  readonly maxTokens?: number
  /** Optional provider model id (e.g. a version string). Provider-defined. */
  readonly model?: string
}

/** A single completion request sent to a provider. */
export interface CompletionRequest extends CompletionOptions {
  readonly messages: readonly PromptMessage[]
  /** Whether a strict JSON object is expected in the reply. */
  readonly responseFormat: 'json' | 'text'
}

/** Token accounting a provider may report back (all optional). */
export interface TokenUsage {
  readonly promptTokens?: number
  readonly completionTokens?: number
  readonly totalTokens?: number
}

/** A single completion result returned by a provider. */
export interface CompletionResult {
  /** The raw text the model produced. */
  readonly text: string
  /** The model id that produced it, when known. */
  readonly model?: string
  /** The provider's finish reason (e.g. `stop`, `length`), when known. */
  readonly finishReason?: string
  readonly usage?: TokenUsage
}

/** Build a provider request from a Sprint 4 {@link PromptPackage}. */
export function toCompletionRequest(
  prompt: PromptPackage,
  options?: CompletionOptions,
): CompletionRequest {
  return {
    messages: prompt.messages,
    responseFormat: 'json',
    temperature: options?.temperature ?? 0,
    maxTokens: options?.maxTokens,
    model: options?.model,
  }
}
