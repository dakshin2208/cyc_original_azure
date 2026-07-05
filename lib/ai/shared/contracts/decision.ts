/**
 * @module lib/ai/shared/contracts/decision
 *
 * The Reasoning module's terminal output: a grounded, confidence-scored,
 * explainable {@link Decision}, or a principled {@link Abstention}
 * (Reasoning Engine, doc 05 §7–§10). The concrete payload is generic so this
 * contract stays decoupled from the individual engine result types.
 */

import type { AbstentionReason, ConfidenceLevel, ConflictKind, GapToken } from '../enums'
import type { Citation } from './evidence'

/** A single disclosed knowledge gap with a user-facing message. */
export interface Gap {
  /** The gap token. */
  readonly token: GapToken
  /** A user-facing explanation of what could not be considered. */
  readonly message: string
}

/** Per-dimension inputs to the overall confidence score (doc 05 §8). */
export interface ConfidenceBreakdown {
  /** Share of required inputs that were present (not imputed), [0, 1]. */
  readonly dataCompleteness: number
  /** Recency score of the data used, [0, 1]. */
  readonly freshness: number
  /** Cross-source agreement, [0, 1]. */
  readonly evidenceAgreement: number
  /** Certainty of the eligibility prediction, or `null` if not applicable. */
  readonly predictionCertainty: number | null
  /** Certainty/separation of the recommendation ranking, or `null`. */
  readonly recommendationCertainty: number | null
  /** Certainty of the reasoning itself (fewer inferential leaps = higher). */
  readonly reasoningCertainty: number
}

/** The composed confidence for a decision, with its weakest links surfaced. */
export interface ConfidenceScore {
  /** Overall confidence in [0, 1]. */
  readonly overall: number
  /** Human-facing band derived from `overall`. */
  readonly level: ConfidenceLevel
  /** The sub-scores that composed `overall`. */
  readonly breakdown: ConfidenceBreakdown
  /** Names of the weakest contributing dimensions (drivers of caveats). */
  readonly weakest: readonly string[]
}

/** The role a single explanation fragment plays. */
export type ExplanationKind = 'why' | 'why_not' | 'trade_off' | 'admission' | 'alternative' | 'caveat'

/** One fragment of a structured explanation, linked back to its evidence. */
export interface ExplanationPart {
  /** What role this fragment plays. */
  readonly kind: ExplanationKind
  /** The explanation text. */
  readonly text: string
  /** Keys of the evidence items this fragment is grounded in. */
  readonly evidenceKeys: readonly string[]
}

/** A structured, citation-backed explanation assembled before narration. */
export interface Explanation {
  /** The explanation fragments. */
  readonly parts: readonly ExplanationPart[]
  /** Sources cited by the explanation. */
  readonly citations: readonly Citation[]
}

/** A detected disagreement between two pieces of evidence (doc 05 §3, stage ⑧). */
export interface EvidenceConflict {
  /** The nature of the conflict. */
  readonly kind: ConflictKind
  /** The evidence keys involved. */
  readonly keys: readonly string[]
  /** How it was resolved, or a note that it lowered confidence. */
  readonly resolution: string
}

/** What kind of answer a decision represents. */
export type DecisionKind = 'answer' | 'eligibility' | 'recommendation' | 'comparison' | 'knowledge'

/**
 * A grounded reasoning outcome carrying a typed payload plus its confidence,
 * explanation, disclosed gaps, and any conflicts encountered.
 * @typeParam TPayload The concrete result type (e.g. `EligibilityResult`).
 */
export interface Decision<TPayload = unknown> {
  /** Discriminator for the {@link ReasoningOutcome} union. */
  readonly kind: 'decision'
  /** The type of answer produced. */
  readonly decisionKind: DecisionKind
  /** The concrete engine result. */
  readonly payload: TPayload
  /** Composed confidence. */
  readonly confidence: ConfidenceScore
  /** The structured, citation-backed explanation. */
  readonly explanation: Explanation
  /** Disclosed knowledge gaps. */
  readonly gaps: readonly Gap[]
  /** Any evidence conflicts encountered and how they were handled. */
  readonly conflicts: readonly EvidenceConflict[]
}

/** A principled non-answer — a first-class reasoning outcome (doc 05 §10). */
export interface Abstention {
  /** Discriminator for the {@link ReasoningOutcome} union. */
  readonly kind: 'abstention'
  /** Why the counselor declined. */
  readonly reason: AbstentionReason
  /** A user-facing explanation. */
  readonly message: string
  /** Structural gaps responsible for the abstention, if any. */
  readonly missing: readonly GapToken[]
  /** A concrete next step the student can take, if any. */
  readonly nextStep: string | null
}

/**
 * The Reasoning module's terminal output for a turn.
 * @typeParam TPayload The concrete decision payload type.
 */
export type ReasoningOutcome<TPayload = unknown> = Decision<TPayload> | Abstention
