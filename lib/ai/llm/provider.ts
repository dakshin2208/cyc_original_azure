/**
 * @module lib/ai/llm/provider
 *
 * The provider abstraction. A provider is a THIN transport: it takes a
 * {@link CompletionRequest} and returns a {@link CompletionResult}. It contains NO
 * business logic — no parsing, no validation, no hallucination handling (those
 * live in the adapter/validator). Providers are swappable; the future OpenAI,
 * Claude, and Gemini providers will each implement this one interface by wrapping
 * their SDK. This module deliberately ships NO SDK and makes NO network call.
 */

import type { CompletionRequest, CompletionResult } from './message'
import { ProviderError } from './errors'

/** The single interface every LLM provider implements. */
export interface LLMProvider {
  /** Stable provider name (e.g. `openai`, `claude`, `gemini`, `static`). */
  readonly name: string
  /** Produce one completion. May reject with {@link ProviderError}. */
  complete(request: CompletionRequest): Promise<CompletionResult>
}

/** A responder: the pure/async function a real SDK call would sit behind. */
export type Responder = (request: CompletionRequest) => Promise<CompletionResult> | CompletionResult

/**
 * Build a provider from a responder function — the dependency-injection seam.
 * A real provider (Sprint 6+) wraps its SDK client in exactly this shape.
 */
export function createFunctionProvider(name: string, responder: Responder): LLMProvider {
  return Object.freeze({
    name,
    complete: async (request: CompletionRequest): Promise<CompletionResult> => {
      const result = await responder(request)
      if (typeof result.text !== 'string') {
        throw new ProviderError(`provider "${name}" returned a non-string completion`, { name })
      }
      return result
    },
  })
}

/** A provider that always returns the same fixed text (dev/tests only). */
export function createStaticProvider(name: string, text: string): LLMProvider {
  return createFunctionProvider(name, () => ({ text, model: name, finishReason: 'stop' }))
}

/** A provider that always fails — for exercising the adapter's fallback path. */
export function createUnavailableProvider(name: string, reason = 'provider unavailable'): LLMProvider {
  return Object.freeze({
    name,
    complete: async (): Promise<CompletionResult> => {
      throw new ProviderError(reason, { name })
    },
  })
}
