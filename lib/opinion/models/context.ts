/**
 * @module lib/opinion/models/context
 * The structured opinion context + the deterministic opinion result.
 */

import type { CommunityCode } from '@/lib/knowledge'
import type { ComparisonResult } from '@/lib/recommendation'
import type {
  ConfidenceLevel,
  EvidencePackage,
  MissingInformation,
} from '@/lib/ai/orchestration'
import type { CollegeDossier } from './dossier'
import type { OpinionStrategy, Priority } from './enums'
import type { OpinionRecommendation } from './recommendation'

/** The structured context the opinion generator reasons over. */
export interface OpinionContext {
  readonly strategy: OpinionStrategy
  readonly priorities: readonly Priority[]
  readonly studentCutoff: number | null
  readonly community: CommunityCode | null
  readonly branch: string | null
  readonly candidates: readonly CollegeDossier[]
  readonly comparison: ComparisonResult | null
  /** The deduplicated, id-stamped evidence set (reused from Sprint 4). */
  readonly evidence: EvidencePackage
  readonly missingInformation: readonly MissingInformation[]
}

/** The deterministic opinion output (before the LLM phrases it). */
export interface OpinionResult {
  readonly strategy: OpinionStrategy
  readonly recommendations: readonly OpinionRecommendation[]
  readonly confidence: ConfidenceLevel
  readonly missingInformation: readonly MissingInformation[]
  /** Every evidence id referenced across the recommendations. */
  readonly evidenceIds: readonly string[]
}
