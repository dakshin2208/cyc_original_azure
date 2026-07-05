/**
 * @module lib/ai/orchestration/models/prompt
 *
 * Prompt DTOs — the provider-agnostic package a future LLM adapter will send.
 * These are DATA only: assembling them performs no inference and calls no model.
 */

/** A chat message in the neutral role vocabulary shared by GPT/Claude/Gemini. */
export interface PromptMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** The final, LLM-ready prompt package. */
export interface PromptPackage {
  /** System instructions + business rules + anti-hallucination policy. */
  readonly system: string
  /** The serialized deterministic context (facts, recommendations, evidence). */
  readonly context: string
  /** Output formatting rules (structure the LLM must return). */
  readonly formatting: string
  /** The user's original question. */
  readonly user: string
  /** Ready-to-send message array (system + context + user). */
  readonly messages: readonly PromptMessage[]
  /** Non-prompt metadata for logging/routing. */
  readonly metadata: PromptMetadata
}

/** Metadata describing how the prompt was built (not sent to the model as prose). */
export interface PromptMetadata {
  readonly intent: string
  readonly evidenceCount: number
  readonly subjectCount: number
  readonly hasRecommendations: boolean
  readonly hasComparison: boolean
  /** Approximate character budget of the assembled prompt. */
  readonly approxChars: number
}
