/**
 * @module lib/recommendation/strategies/executor
 *
 * The shared strategy executor. Every strategy is a thin config-driven spec
 * (category + weights + optional filter + notes); the ranking pipeline —
 * score → deterministic sort → explain → assess eligibility → assemble result —
 * lives here ONCE so no strategy duplicates it. Fully deterministic, including
 * stable tie-breaks. No AI.
 */

import { normalizeBranch } from '@/lib/knowledge'
import type { DimensionWeights, RecommendationConfig } from '../config'
import type { CutoffLookup, ProfileProvider } from '../data'
import type { EligibilityEngine } from '../eligibility'
import type { ReasonGenerator } from '../reasons'
import { reputationTier, tierBandedTotal } from '../reputation'
import type { ScoringEngine } from '../scoring'
import {
  type CollegeProfile,
  type EligibilityAssessment,
  type RecommendationCategory,
  type RecommendationRequest,
  type RecommendationResult,
  type RecommendationScore,
  type ReputationTier,
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
  readonly tier: ReputationTier
}

/**
 * The share of the [0, 1] ranking-total range reserved for colleges whose eligibility
 * could NOT be verified (no closing cutoff on file). Verified colleges occupy
 * [RESERVED, 1]; unverified ones [0, RESERVED) — so a verified college always outranks
 * an unverified one while the total stays a single monotone sort key (UAT F1).
 */
const RESERVED_UNVERIFIED = 0.05

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

  // District filter (RC2): candidates outside the requested district are removed
  // BEFORE scoring — the engine never ranks or recommends an out-of-district college.
  const districtWanted = request.district?.trim().toLowerCase()
  const inDistrict = (p: CollegeProfile): boolean =>
    !districtWanted || (p.district ?? '').toLowerCase() === districtWanted

  // Eligibility filter (RC4): with the student's cutoff + community known, exclude
  // colleges they are clearly ineligible for (well below the closing cutoff →
  // "dream"). Unknown cutoffs are KEPT — we never fabricate ineligibility.
  const eligible = (p: CollegeProfile): boolean => {
    if (request.includeIneligible) return true // band strategies select their own band
    if (request.studentCutoff === undefined || request.community === undefined) return true
    return (
      ctx.eligibility.assess({
        college: p.college,
        studentCutoff: request.studentCutoff,
        community: request.community,
        branch: request.branch,
      }).category !== 'dream'
    )
  }

  const hasRequired = (score: RecommendationScore): boolean =>
    spec.requires === undefined ||
    spec.requires.every((dim) => score.dimensions.find((d) => d.dimension === dim)?.hasData === true)

  // Reputation tier is embedded as a disjoint band in the total (tiers dominate;
  // scores refine), so the ranking stays a single stable, monotone sort.
  const scored: Scored[] = ctx.profiles
    .listProfiles()
    .filter((p) => (spec.accepts ? spec.accepts(p) : true))
    .filter(inDistrict)
    .filter(eligible)
    .map((profile) => {
      const raw = ctx.scoring.score(profile, spec.weights)
      const tier = reputationTier(profile, ctx.config.reputation)
      const banded = tierBandedTotal(tier, raw.total, ctx.config.reputation)
      // Whether the student's eligibility for this college could be VERIFIED (a closing
      // cutoff was found). When no cutoff+community is supplied there is nothing to
      // verify, so no college is penalized.
      const verified =
        request.studentCutoff === undefined || request.community === undefined
          ? true
          : ctx.eligibility.assess({
              college: profile.college,
              studentCutoff: request.studentCutoff,
              community: request.community,
              branch: request.branch,
            }).hasData
      // Confine unverifiable-eligibility colleges to a reserved bottom band of the
      // total, so a college whose eligibility we CANNOT verify never outranks one we
      // can — while the total stays monotone, keeping ranking a single stable sort
      // (UAT finding F1, requirement 3).
      const total = verified ? RESERVED_UNVERIFIED + banded * (1 - RESERVED_UNVERIFIED) : banded * RESERVED_UNVERIFIED
      const score: RecommendationScore = { ...raw, total }
      return { profile, score, tier }
    })
    .filter(({ score }) => hasRequired(score))

  // Branch preference (RC: respect the preferred branch): when a branch is requested AND
  // at least one in-scope college actually offers it, rank colleges that OFFER it first,
  // colleges with unknown offerings next, and colleges that offer OTHER branches (but not
  // this one) last — so an "AI & DS" ask prefers AI&DS colleges over ones that only offer
  // generic CSE. A no-op when the branch is unrecognized or no candidate offers it (the
  // data cannot help, so the quality ranking is left exactly as before). Deterministic.
  const wantedBranch = request.branch ? normalizeBranch(request.branch).canonicalName : null
  const branchActive = wantedBranch !== null && scored.some((s) => s.profile.branchesOffered.has(wantedBranch))
  const branchTier = (p: CollegeProfile): number => {
    if (!branchActive || wantedBranch === null) return 0
    if (p.branchesOffered.has(wantedBranch)) return 0
    return p.branchesOffered.size === 0 ? 1 : 2
  }
  const ranked = [...scored].sort((a, b) => branchTier(a.profile) - branchTier(b.profile) || compareScored(a, b))

  return ranked.slice(0, Math.max(0, limit)).map(({ profile, score }, index) => {
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
