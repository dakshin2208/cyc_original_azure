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

/** Synthesize a grounded, counselor-style answer from the recommendation objects. */
function deterministicAnswer(result: OpinionResult): string {
  if (result.strategy === 'insufficient_evidence') {
    return (
      "I don't have enough to go on yet — share your cutoff mark and community (and ideally your " +
      "preferred district and branch), and I'll suggest the colleges you can realistically get."
    )
  }
  const recs = result.recommendations
  // Strip a leading "College Name:" (with or without a trailing space — the generator
  // trims the line, so an empty-reason line becomes a bare "Name:") and return what's
  // left. Empty means there was no substantive reason to show.
  const stripName = (line: string, name: string): string =>
    line.startsWith(name) ? line.slice(name.length).replace(/^:\s*/, '').trim() : line.trim()

  // Head-to-head comparison.
  const cmp = recs.find((r) => r.kind === 'comparison')
  if (cmp) {
    const parts = [cmp.colleges.length >= 2 ? `Here's how ${cmp.colleges.join(' and ')} compare:` : `${cmp.headline}.`]
    for (const line of cmp.reasoning) parts.push(line)
    if (cmp.tradeoffs.length > 0) parts.push(`Trade-offs — ${cmp.tradeoffs.join(' ')}`)
    if (cmp.risks.length > 0) parts.push(`Note: ${cmp.risks.join(' ')}`)
    return parts.join('\n').trim()
  }

  const parts: string[] = []
  const top = recs.find((r) => r.kind === 'top_pick')
  if (top && top.colleges.length > 0) {
    const name = top.colleges[0]
    const whyText = top.reasoning[0] ? stripName(top.reasoning[0], name) : ''
    parts.push(`My top recommendation is ${name}${whyText ? ` — ${whyText}` : ''}.`)
    const cautions = [...top.tradeoffs.map((t) => stripName(t, name)), ...top.risks].filter((c) => c.length > 0)
    if (cautions.length > 0) parts.push(`Just note: ${cautions.join(' ')}`)
  }
  const alt = recs.find((r) => r.kind === 'alternative')
  if (alt && alt.colleges.length > 0) {
    parts.push('\nOther strong options for you:')
    for (const name of alt.colleges) {
      const line = alt.reasoning.find((r) => r.startsWith(name))
      const whyText = line ? stripName(line, name) : ''
      parts.push(`• ${name}${whyText ? ` — ${whyText}` : ''}`)
    }
  }
  // Band buckets (safe / moderate / dream) for "which colleges can I get" queries.
  for (const r of recs) {
    if (r.kind === 'top_pick' || r.kind === 'alternative' || r.colleges.length === 0) continue
    parts.push(`\n${r.headline}: ${r.colleges.join(', ')}.`)
  }
  if (parts.length === 0) {
    for (const r of recs) if (r.colleges.length > 0) parts.push(`${r.headline}: ${r.colleges.join(', ')}.`)
  }
  parts.push('\nYou can ask me to compare any two of these, show safer backup options, or dig into placements.')
  return parts.join('\n').trim()
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
