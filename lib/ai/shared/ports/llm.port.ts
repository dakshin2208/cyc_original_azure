/**
 * @module lib/ai/shared/ports/llm.port
 *
 * The language-model boundary (Dependency Inversion). Modules depend on this
 * interface; a concrete adapter (e.g. Anthropic) implements it and is injected
 * at the composition root (AI Architecture, doc 03 §12; Project Structure, doc 07 §9).
 */

import type { RequestContext } from '../contracts/request-context'

/** Model capability/cost tier selected per task. */
export type ModelTier = 'fast' | 'balanced' | 'strong'

/** A single conversational message supplied to the model. */
export interface LlmMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** A tool/function the model may call, described by a JSON-schema parameter map. */
export interface LlmToolSchema {
  readonly name: string
  readonly description: string
  readonly parameters: Readonly<Record<string, unknown>>
}

/** A fully-formed prompt plus generation controls (built by the Prompt module). */
export interface PromptSpec {
  /** System/persona instruction. */
  readonly system: string
  /** Conversation messages. */
  readonly messages: readonly LlmMessage[]
  /** Optional tool schemas the model may call. */
  readonly tools?: readonly LlmToolSchema[]
  /** Optional maximum output tokens. */
  readonly maxTokens?: number
  /** Optional sampling temperature. */
  readonly temperature?: number
}

/** A tool invocation requested by the model. */
export interface LlmToolCall {
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
}

/** Token accounting for a model call. */
export interface LlmUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}

/** The result of a non-streaming model call. */
export interface LlmResult {
  /** Generated text (may be empty when only tool calls are returned). */
  readonly text: string
  /** Any tool calls the model requested. */
  readonly toolCalls: readonly LlmToolCall[]
  /** Token usage. */
  readonly usage: LlmUsage
}

/** A single chunk of a streamed model response. */
export interface LlmStreamChunk {
  /** The incremental text delta. */
  readonly delta: string
  /** Whether this is the final chunk. */
  readonly done: boolean
}

/**
 * The language-model port. Implementations own model routing per {@link ModelTier},
 * tool-calling, streaming, retries, and telemetry.
 */
export interface LlmPort {
  /**
   * Run a non-streaming completion.
   * @param spec The prompt and controls.
   * @param tier The capability tier to route to.
   * @param context The current turn's request context.
   */
  complete(spec: PromptSpec, tier: ModelTier, context: RequestContext): Promise<LlmResult>

  /**
   * Run a streaming completion, yielding incremental chunks.
   * @param spec The prompt and controls.
   * @param tier The capability tier to route to.
   * @param context The current turn's request context.
   */
  stream(spec: PromptSpec, tier: ModelTier, context: RequestContext): AsyncIterable<LlmStreamChunk>
}
