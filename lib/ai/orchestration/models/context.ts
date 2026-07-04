/**
 * @module lib/ai/orchestration/models/context
 *
 * The Context Package — the single structured object that fully describes what
 * the deterministic engines decided for one query. It is the hand-off to the
 * Prompt Builder. It contains NO prompt text and NO natural-language generation.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { ComparisonResult, RecommendationResult } from '@/lib/recommendation'
import type { ExtractedEntity } from './entities'
import type { ConfidenceLevel, EntityType, MissingSeverity, QueryIntent } from './enums'
import type { EvidencePackage } from './evidence'

/** A structured fact retrieved for a specifically named college. */
export interface RetrievedFact {
  readonly collegeName: string
  readonly label: string
  readonly value: string | number | null
  /** Warehouse origin (e.g. `placement`, `finance`, `research`, `faculty`, `nirf`). */
  readonly origin: string
}

/** A named information gap that limited (or blocked) the answer. */
export interface MissingInformation {
  /** The missing field/entity. */
  readonly field: EntityType | 'cutoff_dataset' | 'fees_dataset' | 'branch_linkage'
  readonly severity: MissingSeverity
  /** Machine-readable reason. */
  readonly reason: string
}

/** A deterministic clarifying question to ask the user next. */
export interface FollowUpQuestion {
  /** The question text (a fixed template, not generated prose). */
  readonly question: string
  /** Which entity/field an answer would supply. */
  readonly expects: MissingInformation['field']
  /** Why it is being asked. */
  readonly reason: string
}

/** Per-section + overall confidence for the context. */
export interface ContextConfidence {
  readonly overall: number
  readonly level: ConfidenceLevel
  /** Fraction of the evidence backed by data, in [0, 1]. */
  readonly evidenceCompleteness: number
}

/**
 * The complete structured context for one query. Consumed by the Prompt Builder;
 * never contains prompt text.
 */
export interface ContextPackage {
  readonly intent: QueryIntent
  readonly intentConfidence: number
  readonly entities: readonly ExtractedEntity[]
  /** Colleges the query is about (resolved canonical entities). */
  readonly subjects: readonly CanonicalCollege[]
  readonly recommendations: readonly RecommendationResult[]
  readonly comparison: ComparisonResult | null
  readonly facts: readonly RetrievedFact[]
  readonly evidence: EvidencePackage
  readonly confidence: ContextConfidence
  readonly missingInformation: readonly MissingInformation[]
  readonly followUpQuestions: readonly FollowUpQuestion[]
  /** Human-readable caveats carried forward from the engines. */
  readonly notes: readonly string[]
}
