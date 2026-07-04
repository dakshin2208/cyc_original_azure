/**
 * @module lib/recommendation/strategies/executor
 *
 * The shared strategy executor. Every strategy is a thin config-driven spec
 * (category + weights + optional filter + notes); the ranking pipeline —
 * score → deterministic sort → explain → assess eligibility → assemble result —
 * lives here ONCE so no strategy duplicates it. Fully deterministic, including
 * stable tie-breaks. No AI.
 */

import type { DimensionWeights, RecommendationConfig } from '../config'
import type { CutoffLookup, ProfileProvider } from '../data'
import type { EligibilityEngine } from '../eligibility'
import type { ReasonGenerator } from '../reasons'
import type { ScoringEngine } from '../scoring'
import {
  type CollegeProfile,
  type EligibilityAssessment,
  type RecommendationCategory,
  type RecommendationRequest,
  type RecommendationResult,
  type RecommendationScore,
  type ScoreDimension,
} from '../models'

/** The dependencies a strategy needs, injected once by the facade. */
export interface StrategyContext {
  readonly profiles: ProfileProvider
  readonly scoring: ScoringEngine
  readonly reasons: ReasonGenerator
  readonly eligibility: EligibilityEngine
  /** Present only to advertise cutoff availability; scoring never depends on it. */
  readonly cutoffs: CutoffLookup
  readonly config: RecommendationConfig
}

/** A ranking specification produced by a strategy. */
export interface RankSpec {
  readonly category: RecommendationCategory
  readonly weights: DimensionWeights
  /** Optional profile-level inclusion filter (applied before scoring). */
  readonly accepts?: (profile: CollegeProfile) => boolean
  /**
   * Dimensions whose data MUST be present to be ranked. A dimension-focused
   * strategy (e.g. "best placement") excludes colleges lacking that dimension's
   * data, so it never surfaces a college it has no evidence for on the very axis
   * it ranks by. Renormalization still applies to the dimensions that remain.
   */
  readonly requires?: readonly ScoreDimension[]
  /** Strategy-level caveats attached to every result. */
  readonly notes?: readonly string[]
}

interface Scored {
  readonly profile: CollegeProfile
  readonly score: RecommendationScore
}

/** Deterministic string order (locale-independent). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Total order over scored colleges: higher total first, then more complete data,
 * then name, then id. Guarantees a stable, reproducible ranking on ties.
 */
function compareScored(a: Scored, b: Scored): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total
  if (b.score.dataCompleteness !== a.score.dataCompleteness) {
    return b.score.dataCompleteness - a.score.dataCompleteness
  }
  const byName = cmpStr(a.profile.college.name, b.profile.college.name)
  return byName !== 0 ? byName : cmpStr(a.profile.college.id, b.profile.college.id)
}

/** Run the full ranking pipeline for a spec + request. */
export function rankProfiles(
  ctx: StrategyContext,
  spec: RankSpec,
  request: RecommendationRequest,
): readonly RecommendationResult[] {
  const limit = request.limit ?? ctx.config.defaultLimit
  const canAssess = request.studentCutoff !== undefined && request.community !== undefined

  const hasRequired = (score: RecommendationScore): boolean =>
    spec.requires === undefined ||
    spec.requires.every((dim) => score.dimensions.find((d) => d.dimension === dim)?.hasData === true)

  const scored: Scored[] = ctx.profiles
    .listProfiles()
    .filter((p) => (spec.accepts ? spec.accepts(p) : true))
    .map((profile) => ({ profile, score: ctx.scoring.score(profile, spec.weights) }))
    .filter(({ score }) => hasRequired(score))
    .sort(compareScored)

  return scored.slice(0, Math.max(0, limit)).map(({ profile, score }, index) => {
    const explanation = ctx.reasons.explain(profile, score, spec.category)
    const eligibility: EligibilityAssessment | null =
      canAssess && request.community !== undefined
        ? ctx.eligibility.assess({
            college: profile.college,
            studentCutoff: request.studentCutoff as number,
            community: request.community,
            branch: request.branch,
          })
        : null

    return {
      college: profile.college,
      rank: index + 1,
      category: spec.category,
      score,
      explanation,
      confidence: explanation.confidence,
      eligibility,
      notes: spec.notes ?? [],
    }
  })
}
