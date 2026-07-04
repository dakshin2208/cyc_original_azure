/**
 * @module lib/opinion/formatter/opinion-formatter
 *
 * Opinion Formatter (Module 6). Converts the validated output into the response
 * contract: {answer, evidence, confidence, follow-ups, recommendation summary}.
 * When the model answer is accepted it is used verbatim; otherwise a DETERMINISTIC,
 * fully-grounded answer is synthesized from the recommendation objects (so the
 * engine always returns a safe, evidence-based response — including a graceful
 * "I don't have enough evidence…" when appropriate). No AI.
 */

import type { LLMResult } from '@/lib/ai/llm'
import type { FollowUpQuestion, ResponseCitation } from '@/lib/ai/orchestration'
import type {
  OpinionContext,
  OpinionResponse,
  OpinionResult,
  RecommendationSummaryItem,
} from '../models'
import type { OpinionValidation } from '../validator/opinion-validator'

const MAX_CITATIONS = 12

/** Build citations from the opinion evidence ids (for the deterministic path). */
function citationsFromEvidence(context: OpinionContext, evidenceIds: readonly string[]): ResponseCitation[] {
  const wanted = new Set(evidenceIds)
  return context.evidence.items
    .filter((i) => wanted.has(i.id))
    .slice(0, MAX_CITATIONS)
    .map((i) => ({ evidenceId: i.id, collegeName: i.collegeName, label: i.label, source: i.source }))
}

/** Synthesize a grounded counselor answer from the recommendation objects. */
function deterministicAnswer(result: OpinionResult): string {
  if (result.strategy === 'insufficient_evidence') {
    return (
      "I don't have enough evidence to confidently recommend colleges for this yet. " +
      'Could you share a little more — your cutoff mark and community, or the specific colleges or branch you are considering?'
    )
  }
  const parts: string[] = []
  for (const r of result.recommendations) {
    parts.push(r.colleges.length > 0 ? `${r.headline}: ${r.colleges.join(', ')}.` : `${r.headline}.`)
    if (r.reasoning.length > 0) parts.push(r.reasoning.join(' '))
    if (r.tradeoffs.length > 0) parts.push(`Trade-offs — ${r.tradeoffs.join(' ')}`)
    if (r.risks.length > 0) parts.push(`Please note: ${r.risks.join(' ')}`)
  }
  return parts.join(' ').trim()
}

function summarize(result: OpinionResult): RecommendationSummaryItem[] {
  return result.recommendations.map((r) => ({
    kind: r.kind,
    headline: r.headline,
    colleges: r.colleges,
    confidence: r.confidence,
  }))
}

/** Format the final opinion response. */
export function formatOpinion(input: {
  readonly result: OpinionResult
  readonly context: OpinionContext
  readonly followUps: readonly FollowUpQuestion[]
  readonly llm: LLMResult
  readonly validation: OpinionValidation
}): OpinionResponse {
  const { result, context, followUps, llm, validation } = input
  const usedModel = validation.ok

  return {
    answer: usedModel ? llm.response.answer : deterministicAnswer(result),
    evidence: usedModel ? llm.response.citations : citationsFromEvidence(context, result.evidenceIds),
    confidence: result.confidence,
    followUps,
    recommendationSummary: summarize(result),
    strategy: result.strategy,
    usedModel,
  }
}
