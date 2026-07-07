/**
 * @module lib/ai/chat/trust-pipeline
 *
 * The Trust Pipeline — the single, explicit seam between capability execution and the
 * LLM. Every capability answer flows through here, and conceptually through:
 *
 *   Capability → Evidence → Grounding → Validation → Narration → Response
 *
 * The stages themselves are already implemented (and un-bypassable) inside the reused
 * Opinion engine, which this pipeline delegates to WITHOUT modification:
 *   • Evidence    — the orchestrator retrieves warehouse evidence + recommendations
 *   • Grounding   — the prompt is built from that evidence (the LLM only rewords it)
 *   • Narration   — the LLM adapter produces prose, with its own grounding guards
 *   • Validation  — the opinion validator re-audits the model output against evidence
 *   • Response    — the formatter approves model prose only if validation passes, else
 *                   returns the deterministic, grounded answer
 *
 * This module does NOT do orchestration, capability selection, business reasoning,
 * persistence, or session management — it only names and centralizes the trust boundary
 * the chat layer crosses. Behavior is identical to calling the opinion service directly.
 */

import type { AdviceResult, OpinionService } from '@/lib/opinion'

/** Options for a trust-pipeline run — the same options the opinion engine accepts. */
export type TrustRunOptions = Parameters<OpinionService['advise']>[1]

/** A grounded, validated, approved turn result (response + updated conversation state). */
export type TrustResult = AdviceResult

/** The explicit trust boundary every capability answer crosses on its way to a response. */
export interface TrustPipeline {
  /** Deterministic query understanding (NLU input to routing) — no reasoning/LLM. */
  parse(message: string): ReturnType<OpinionService['parse']>
  /**
   * Run a query through Evidence → Grounding → Validation → Narration → Response, returning
   * an approved (grounded/validated) result. Delegates to the reused Opinion engine.
   */
  run(message: string, options?: TrustRunOptions): Promise<TrustResult>
}

/**
 * Build the trust pipeline over the reused {@link OpinionService}. Pure delegation — the
 * grounding/validation/narration logic stays inside the opinion engine, unchanged.
 */
export function createOpinionTrustPipeline(opinion: OpinionService): TrustPipeline {
  return Object.freeze({
    parse: (message: string) => opinion.parse(message),
    run: (message: string, options?: TrustRunOptions) => opinion.advise(message, options),
  })
}
