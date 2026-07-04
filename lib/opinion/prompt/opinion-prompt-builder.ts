/**
 * @module lib/opinion/prompt/opinion-prompt-builder
 *
 * Opinion Prompt Builder (Module 4). Serializes the deterministic recommendation
 * objects + grounded evidence + conversation history into a Sprint-4
 * {@link PromptPackage} — so the SAME Sprint-5 LLM adapter (parse + validate +
 * hallucination guard) consumes it unchanged. The prompt embeds a counselor
 * persona, a strict anti-hallucination policy, and an explicit instruction to
 * express uncertainty when evidence is missing. It performs no inference. No AI.
 */

import { FORMATTING_RULES, type PromptMessage, type PromptPackage } from '@/lib/ai/orchestration'
import type { OpinionContext, OpinionResult, ConversationTurn } from '../models'

/** The counselor system policy. */
const OPINION_SYSTEM =
  'You are an expert, honest college counselor. A deterministic engine has already analyzed the ' +
  'warehouse data and produced the RECOMMENDATIONS below — each with reasoning, trade-offs, risks, ' +
  'confidence, and supporting evidence ids. Explain them to the student in warm, clear, balanced language.\n\n' +
  'ABSOLUTE RULES (never violate):\n' +
  '- Use ONLY the RECOMMENDATIONS and EVIDENCE provided. Never invent a college, cutoff, placement figure, fee, scholarship, or ranking.\n' +
  '- Present the recommendations faithfully — do not change which colleges are safe/ambitious, or who wins a comparison.\n' +
  '- State the trade-offs and risks honestly; do not oversell.\n' +
  '- When information is missing or marked unavailable (e.g. fees, cutoffs), say so explicitly rather than guessing.\n' +
  "- If the recommendations indicate insufficient evidence, tell the student you don't have enough evidence to recommend confidently, and ask one clarifying question.\n" +
  '- Attach the supporting evidence ids to every factual claim.'

function serializeRecommendations(result: OpinionResult): string {
  if (result.recommendations.length === 0) return 'RECOMMENDATIONS: none.'
  const blocks = result.recommendations.map((r) => {
    const lines = [
      `  - ${r.kind.toUpperCase()}: ${r.headline}${r.colleges.length > 0 ? ` — ${r.colleges.join(', ')}` : ''} (confidence: ${r.confidence})`,
      r.reasoning.length > 0 ? `     reasoning: ${r.reasoning.join(' ')}` : '',
      r.tradeoffs.length > 0 ? `     trade-offs: ${r.tradeoffs.join(' ')}` : '',
      r.risks.length > 0 ? `     risks: ${r.risks.join(' ')}` : '',
      r.evidenceIds.length > 0 ? `     evidence: ${r.evidenceIds.join(', ')}` : '',
    ]
    return lines.filter((l) => l.length > 0).join('\n')
  })
  return `RECOMMENDATIONS (already decided — explain, do NOT change):\n${blocks.join('\n')}`
}

function serializeEvidence(context: OpinionContext, limit: number): string {
  if (context.evidence.count === 0) return 'EVIDENCE: none available.'
  const shown = context.evidence.items.slice(0, limit)
  const lines = shown.map((e) => {
    const value = e.value === null ? 'UNAVAILABLE' : e.value
    const who = e.collegeName ? `${e.collegeName} | ` : ''
    return `  [${e.id}] ${who}${e.label} = ${value} (${e.source}, ${e.confidenceLevel})`
  })
  const extra = context.evidence.count - shown.length
  return `EVIDENCE (cite these ids):\n${lines.join('\n')}${extra > 0 ? `\n  … (+${extra} more)` : ''}`
}

function serializeHistory(history: readonly ConversationTurn[]): string {
  if (history.length === 0) return ''
  const lines = history.slice(-6).map((t) => `  ${t.role === 'user' ? 'Student' : 'Counselor'}: ${t.content}`)
  return `CONVERSATION SO FAR:\n${lines.join('\n')}`
}

function serializeMissing(context: OpinionContext): string {
  if (context.missingInformation.length === 0) return ''
  return `MISSING / UNAVAILABLE:\n${context.missingInformation.map((m) => `  - ${m.field}: ${m.reason}`).join('\n')}`
}

/** Build the LLM-ready opinion prompt package. */
export function buildOpinionPrompt(input: {
  readonly question: string
  readonly context: OpinionContext
  readonly result: OpinionResult
  readonly history: readonly ConversationTurn[]
  readonly maxEvidence?: number
  /** Override the counselor system prompt (default: the built-in {@link OPINION_SYSTEM}). */
  readonly systemPrompt?: string
}): PromptPackage {
  const { question, context, result, history } = input
  const maxEvidence = input.maxEvidence ?? 24
  const systemBase = input.systemPrompt ?? OPINION_SYSTEM

  const contextBlock = [
    `STRATEGY: ${result.strategy}`,
    serializeRecommendations(result),
    serializeEvidence(context, maxEvidence),
    serializeHistory(history),
    serializeMissing(context),
  ]
    .filter((s) => s.length > 0)
    .join('\n\n')

  const systemFull = `${systemBase}\n\n${FORMATTING_RULES}`
  const user = `${contextBlock}\n\nSTUDENT QUESTION: ${question}`
  const messages: readonly PromptMessage[] = [
    { role: 'system', content: systemFull },
    { role: 'user', content: user },
  ]

  return {
    system: systemBase,
    context: contextBlock,
    formatting: FORMATTING_RULES,
    user: question,
    messages,
    metadata: {
      intent: result.strategy,
      evidenceCount: context.evidence.count,
      subjectCount: context.candidates.length,
      hasRecommendations: result.recommendations.length > 0,
      hasComparison: context.comparison !== null,
      approxChars: systemFull.length + user.length,
    },
  }
}
