/**
 * @module lib/ai/orchestration/models/response
 *
 * The FUTURE AI-response shape. Sprint 4 defines this DTO but never produces it —
 * no LLM is called. A later LLM adapter will return exactly this structure, and
 * every claim it makes must map to a supplied {@link ResponseCitation}.
 */

import type { ConfidenceLevel } from './enums'
import type { ResponseCitation } from './evidence'
import type { FollowUpQuestion } from './context'

/** The structured answer a future LLM adapter is expected to return. */
export interface AIResponse {
  /** The natural-language answer (produced later, by the LLM only). */
  readonly answer: string
  /** Citations backing every factual claim; must reference supplied evidence. */
  readonly citations: readonly ResponseCitation[]
  /** Suggested next questions (may echo the context's follow-ups). */
  readonly followUps: readonly FollowUpQuestion[]
  /** The confidence the deterministic context carried into the answer. */
  readonly confidence: ConfidenceLevel
  /** Whether the answer had to declare some information unavailable. */
  readonly hadMissingInformation: boolean
}
