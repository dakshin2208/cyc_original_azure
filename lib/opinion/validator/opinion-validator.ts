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
 *
 * OBSERVABILITY: every issue carries a stable {@link DiscardCode} alongside its
 * human-readable message. The MESSAGES interpolate model-supplied text (a cited
 * evidence id, a cited college name) and must never leave the process; the CODES are
 * a closed enum and are what the analytics event reports. See `discardCodes`.
 */

import type { LLMResult } from '@/lib/ai/llm'
import type { OpinionContext, OpinionResult } from '../models'

/**
 * Why the model's prose was rejected — a CLOSED enum, safe to emit.
 *
 * These are the only strings that may reach analytics. The matching `issues` messages
 * embed model-generated text (`citation references unknown evidence "<id>"`), so they are
 * kept for local debugging and never logged.
 */
export type DiscardCode =
  // ── this validator ──────────────────────────────────────────────────────────────────
  /** The engine had insufficient evidence — the model is never trusted here. */
  | 'insufficient_evidence'
  /** The LLM pipeline produced no usable answer. The codes below say WHY. */
  | 'llm_unusable'
  /** The model cited an evidence id it was never given. */
  | 'citation_unknown_evidence'
  /** The model cited a college that was not among the candidates. */
  | 'citation_non_candidate_college'
  /** The model recommended colleges while citing nothing at all. */
  | 'uncited_recommendation'
  // ── the LLM layer's own rejections (lib/ai/llm) ─────────────────────────────────────
  // A grounding failure is usually caught HERE first: the adapter rejects the response,
  // retries, and gives up — so the opinion validator only ever sees 'llm_unusable'. Without
  // these, "was it discarded for a citation/grounding failure?" is unanswerable.
  /** The model cited an evidence id that does not exist. */
  | 'unknown_citation'
  /** The model cited a college that does not exist. */
  | 'unknown_cited_college'
  /** The model's output could not be parsed. */
  | 'parse_error'
  /** The provider itself failed (network / 5xx / timeout). */
  | 'provider_error'
  | 'missing_answer'
  | 'missing_confidence'
  /** An unrecognised code — never a raw message (see {@link toDiscardCode}). */
  | 'other'

/** Every code that may be emitted. Anything else is coerced to `'other'`. */
export const DISCARD_CODES: readonly DiscardCode[] = [
  'insufficient_evidence',
  'llm_unusable',
  'citation_unknown_evidence',
  'citation_non_candidate_college',
  'uncited_recommendation',
  'unknown_citation',
  'unknown_cited_college',
  'parse_error',
  'provider_error',
  'missing_answer',
  'missing_confidence',
  'other',
]

/**
 * Coerce an issue code to the closed enum. This is the privacy backstop: only a code from
 * {@link DISCARD_CODES} can ever be emitted, so a future issue whose code was built by
 * interpolation could never smuggle model or student text into the analytics event.
 */
export function toDiscardCode(code: string): DiscardCode {
  return (DISCARD_CODES as readonly string[]).includes(code) ? (code as DiscardCode) : 'other'
}

/** One validation failure: a stable code (emit-safe) + a message (local only). */
export interface OpinionIssue {
  readonly code: DiscardCode
  /** Human-readable, may embed model-supplied text. NEVER emit this to logs/analytics. */
  readonly message: string
}

/** The outcome of opinion validation. */
export interface OpinionValidation {
  /** Whether the model's answer may be used (`false` ⇒ use the deterministic fallback). */
  readonly ok: boolean
  /** Messages (local/debug only — may embed model text). */
  readonly issues: readonly string[]
  /** The stable codes for the same failures — the ONLY form safe to emit. */
  readonly codes: readonly DiscardCode[]
}

/** Build the validation outcome from typed issues (keeps `issues` and `codes` in step). */
function outcome(found: readonly OpinionIssue[]): OpinionValidation {
  return {
    ok: found.length === 0,
    issues: found.map((i) => i.message),
    codes: found.map((i) => i.code),
  }
}

/** Validate the LLM result against the deterministic opinion + evidence. */
export function validateOpinionResponse(
  llm: LLMResult,
  result: OpinionResult,
  context: OpinionContext,
): OpinionValidation {
  const found: OpinionIssue[] = []

  // Insufficient evidence ⇒ never trust the model; use the deterministic answer.
  if (result.strategy === 'insufficient_evidence') {
    return outcome([{ code: 'insufficient_evidence', message: 'insufficient evidence — deterministic response used' }])
  }

  // The Sprint-5 pipeline must have produced a usable answer (not a fallback).
  if (llm.status !== 'ok' && llm.status !== 'repaired') {
    return outcome([{ code: 'llm_unusable', message: `llm did not produce a usable answer (status: ${llm.status})` }])
  }

  const evidenceIds = new Set(context.evidence.items.map((i) => i.id))
  const candidateNames = new Set(context.candidates.map((c) => c.college.name.toLowerCase()))
  const response = llm.response

  for (const c of response.citations) {
    if (!evidenceIds.has(c.evidenceId)) {
      found.push({ code: 'citation_unknown_evidence', message: `citation references unknown evidence "${c.evidenceId}"` })
    }
    if (c.collegeName && !candidateNames.has(c.collegeName.toLowerCase())) {
      found.push({ code: 'citation_non_candidate_college', message: `citation references a non-candidate college "${c.collegeName}"` })
    }
  }

  // A substantive recommendation answer must be backed by at least one citation.
  const hasRealRecommendation = result.recommendations.some((r) => r.kind !== 'insufficient')
  if (hasRealRecommendation && response.citations.length === 0 && response.answer.trim().length > 0) {
    found.push({ code: 'uncited_recommendation', message: 'answer makes recommendations without citing any evidence' })
  }

  return outcome(found)
}
