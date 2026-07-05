/**
 * @module lib/opinion/validator/opinion-validator
 *
 * Response Validator (Module 5). The Sprint-5 adapter has ALREADY parsed the
 * model output, rejected invented citations, and stripped fabricated figures /
 * hallucinated colleges. This validator adds the OPINION-specific gate: the answer
 * must reference the opinion evidence, cite only candidate colleges, and must not
 * present a confident recommendation when the engine determined evidence is
 * insufficient. On failure the formatter falls back to the deterministic,
 * grounded answer. Pure and deterministic; no AI.
 */

import type { LLMResult } from '@/lib/ai/llm'
import type { OpinionContext, OpinionResult } from '../models'

/** The outcome of opinion validation. */
export interface OpinionValidation {
  /** Whether the model's answer may be used (`false` ⇒ use the deterministic fallback). */
  readonly ok: boolean
  readonly issues: readonly string[]
}

/** Validate the LLM result against the deterministic opinion + evidence. */
export function validateOpinionResponse(
  llm: LLMResult,
  result: OpinionResult,
  context: OpinionContext,
): OpinionValidation {
  const issues: string[] = []

  // Insufficient evidence ⇒ never trust the model; use the deterministic answer.
  if (result.strategy === 'insufficient_evidence') {
    return { ok: false, issues: ['insufficient evidence — deterministic response used'] }
  }

  // The Sprint-5 pipeline must have produced a usable answer (not a fallback).
  if (llm.status !== 'ok' && llm.status !== 'repaired') {
    return { ok: false, issues: [`llm did not produce a usable answer (status: ${llm.status})`] }
  }

  const evidenceIds = new Set(context.evidence.items.map((i) => i.id))
  const candidateNames = new Set(context.candidates.map((c) => c.college.name.toLowerCase()))
  const response = llm.response

  for (const c of response.citations) {
    if (!evidenceIds.has(c.evidenceId)) issues.push(`citation references unknown evidence "${c.evidenceId}"`)
    if (c.collegeName && !candidateNames.has(c.collegeName.toLowerCase())) {
      issues.push(`citation references a non-candidate college "${c.collegeName}"`)
    }
  }

  // A substantive recommendation answer must be backed by at least one citation.
  const hasRealRecommendation = result.recommendations.some((r) => r.kind !== 'insufficient')
  if (hasRealRecommendation && response.citations.length === 0 && response.answer.trim().length > 0) {
    issues.push('answer makes recommendations without citing any evidence')
  }

  return { ok: issues.length === 0, issues }
}
