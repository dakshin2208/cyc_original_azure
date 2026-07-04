/**
 * @module lib/ai/orchestration/prompt/prompt-builder
 *
 * PromptBuilder (Module 5) — deterministically serializes a {@link ContextPackage}
 * into a provider-agnostic {@link PromptPackage}: system policy + business rules +
 * anti-hallucination instructions, the retrieved facts, recommendation results,
 * ranked evidence, missing-information, and the output contract. It performs NO
 * inference and calls NO model — it only assembles strings and a message array.
 */

import type { OrchestrationConfig } from '../config'
import type { ContextPackage, PromptMessage, PromptPackage } from '../models'
import { composeSystemPrompt, FORMATTING_RULES } from './business-rules'

/** The PromptBuilder component. */
export interface PromptBuilder {
  build(context: ContextPackage, question: string): PromptPackage
}

function serializeRecommendations(ctx: ContextPackage, limit: number): string {
  if (ctx.recommendations.length === 0) return 'RECOMMENDATIONS: none.'
  const shown = ctx.recommendations.slice(0, limit)
  const lines = shown.map((r) => {
    const reasons = r.explanation.reasons
      .map((reason) => `${reason.summary} (${reason.strength})`)
      .join('; ')
    return `  ${r.rank}. ${r.college.name} — score ${r.score.total.toFixed(3)}, confidence ${r.confidence.level}${reasons ? `; reasons: ${reasons}` : ''}`
  })
  const extra = ctx.recommendations.length - shown.length
  return `RECOMMENDATIONS (already ranked by the engine):\n${lines.join('\n')}${extra > 0 ? `\n  … (+${extra} more not shown)` : ''}`
}

function serializeComparison(ctx: ContextPackage): string {
  const cmp = ctx.comparison
  if (!cmp) return ''
  const winner = cmp.winner ? cmp.winner.name : 'no clear winner (tie)'
  const dims = cmp.dimensions
    .filter((d) => d.winner)
    .map((d) => `${d.dimension}→${d.winner!.name}`)
    .join(', ')
  return `COMPARISON (already computed):\n  Overall winner: ${winner}\n  Per-dimension winners: ${dims || 'none'}`
}

function serializeFacts(ctx: ContextPackage): string {
  if (ctx.facts.length === 0) return ''
  const lines = ctx.facts.map(
    (f) => `  - ${f.collegeName} | ${f.label} = ${f.value === null ? 'UNAVAILABLE' : f.value} (${f.origin})`,
  )
  return `RETRIEVED FACTS:\n${lines.join('\n')}`
}

function serializeEvidence(ctx: ContextPackage, limit: number): string {
  if (ctx.evidence.count === 0) return 'EVIDENCE: none available.'
  const shown = ctx.evidence.items.slice(0, limit)
  const lines = shown.map((e) => {
    const value = e.value === null ? 'UNAVAILABLE' : e.value
    const who = e.collegeName ? `${e.collegeName} | ` : ''
    return `  [${e.id}] ${who}${e.label} = ${value} (source: ${e.source}, confidence: ${e.confidenceLevel})`
  })
  const extra = ctx.evidence.count - shown.length
  return `EVIDENCE (cite these ids):\n${lines.join('\n')}${extra > 0 ? `\n  … (+${extra} more not shown)` : ''}`
}

function serializeGaps(ctx: ContextPackage): string {
  const parts: string[] = []
  if (ctx.missingInformation.length > 0) {
    parts.push(
      `MISSING INFORMATION:\n${ctx.missingInformation.map((m) => `  - ${m.field} (${m.severity}): ${m.reason}`).join('\n')}`,
    )
  }
  if (ctx.followUpQuestions.length > 0) {
    parts.push(
      `SUGGESTED FOLLOW-UP QUESTIONS:\n${ctx.followUpQuestions.map((q) => `  - ${q.question}`).join('\n')}`,
    )
  }
  if (ctx.notes.length > 0) {
    parts.push(`NOTES (caveats to respect):\n${ctx.notes.map((n) => `  - ${n}`).join('\n')}`)
  }
  return parts.join('\n\n')
}

/** Create the prompt builder bound to a resolved config. */
export function createPromptBuilder(config: OrchestrationConfig): PromptBuilder {
  const system = composeSystemPrompt()

  const build = (context: ContextPackage, question: string): PromptPackage => {
    const header =
      `INTENT: ${context.intent} (confidence ${context.intentConfidence.toFixed(2)})\n` +
      `SUBJECT COLLEGES: ${context.subjects.length > 0 ? context.subjects.map((c) => c.name).join(', ') : 'none specified'}\n` +
      `OVERALL CONTEXT CONFIDENCE: ${context.confidence.level} (${context.confidence.overall.toFixed(2)})`

    const contextBlock = [
      header,
      serializeRecommendations(context, config.maxRecommendationsInPrompt),
      serializeComparison(context),
      serializeFacts(context),
      serializeEvidence(context, config.maxEvidenceInPrompt),
      serializeGaps(context),
    ]
      .filter((s) => s.length > 0)
      .join('\n\n')

    const systemFull = `${system}\n\n${FORMATTING_RULES}`
    const user = `${contextBlock}\n\nUSER QUESTION: ${question}`

    const messages: readonly PromptMessage[] = [
      { role: 'system', content: systemFull },
      { role: 'user', content: user },
    ]

    return {
      system,
      context: contextBlock,
      formatting: FORMATTING_RULES,
      user: question,
      messages,
      metadata: {
        intent: context.intent,
        evidenceCount: context.evidence.count,
        subjectCount: context.subjects.length,
        hasRecommendations: context.recommendations.length > 0,
        hasComparison: context.comparison !== null,
        approxChars: systemFull.length + user.length,
      },
    }
  }

  return Object.freeze({ build })
}
