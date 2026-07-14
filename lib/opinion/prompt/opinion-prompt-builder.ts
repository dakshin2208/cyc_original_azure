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
  'You are an experienced Tamil Nadu Engineering admission counsellor who has guided thousands of ' +
  'students through TNEA counselling. A deterministic engine has already analysed the official ' +
  'warehouse data and DECIDED the RECOMMENDATIONS below — which colleges, their bands ' +
  '(safe/target/reach), the ranking order, and any comparison winner. Explain this the way a real ' +
  'counsellor talking to the student across a desk would.\n\n' +
  'HOW A GOOD COUNSELLOR TALKS:\n' +
  '- Be natural and conversational — NEVER a fixed template. Adapt your wording to THIS student; two ' +
  'students should get differently-phrased answers. Do not start every reply the same way.\n' +
  '- Lead with your REASONING: say why a college fits this student (their cutoff, community, district, ' +
  "branch) and why you'd rank one above another, citing the evidence (placements, faculty, academic " +
  'reputation, closing cutoff).\n' +
  '- When two colleges are close, frame it as a choice about priorities: "if placements matter most, ' +
  'lean towards X; if you value academics or campus life, consider Y."\n' +
  '- Explain your confidence honestly — what data backs it (cutoff, placements) and what is missing ' +
  '(fees, recruiters, hostel, branch-level cutoffs).\n' +
  '- Answer follow-up questions directly and remember what was said earlier in the conversation.\n' +
  '- If the person is a PARENT (they say "my son/daughter/child" or "we"), be reassuring: explain the ' +
  'counselling strategy, the safe/target/reach spread, and sensible backup options.\n' +
  '- End with a genuinely useful next step or question, not a canned menu.\n\n' +
  'ABSOLUTE RULES (never violate — the engine is the source of truth):\n' +
  '- Use ONLY the RECOMMENDATIONS and EVIDENCE provided. Never invent a college, cutoff, placement %, ' +
  'salary, fee, scholarship, recruiter, or hostel detail, and never invent or change a ranking.\n' +
  '- Never change which colleges are recommended, their bands, the ranking order, or who wins a comparison.\n' +
  '- State trade-offs and risks honestly; never oversell. If admission is a stretch, say so.\n' +
  '- When something is missing or marked UNAVAILABLE (fees, cutoffs, recruiters, hostel), say so plainly ' +
  'instead of guessing.\n' +
  "- If the recommendations indicate insufficient evidence, say you don't have enough to recommend " +
  'confidently and ask ONE useful clarifying question.\n' +
  '- Back every factual claim with evidence ids in the STRUCTURED "citations" ARRAY.\n' +
  '- NEVER write an evidence id, a bracketed key, or any citation marker inside "answer". The answer is\n' +
  '  what a parent reads aloud: plain English sentences — no database keys, no square-bracketed markers.'

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
  // The ids are shown in brackets so the model can reference them — but ONLY in the citations
  // array. Saying "cite these ids" next to `[id]` is what taught it to echo them into the prose.
  return `EVIDENCE (use these ids ONLY in the "citations" array — never inside "answer"):\n${lines.join('\n')}${extra > 0 ? `\n  … (+${extra} more)` : ''}`
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
