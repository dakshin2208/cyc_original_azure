/**
 * @module lib/recommendation/facade/recommendation-engine
 *
 * The Recommendation Facade (Module 7) — the single public entry point of the
 * Recommendation Engine. It composes the profile provider, scoring engine, reason
 * generator, eligibility engine, strategies, and comparison engine over the
 * Phase 1 repositories and the Sprint 2 Retrieval Engine, and exposes intent-named
 * methods. The engine DECIDES; a future LLM only explains. No AI here.
 */

import type { CanonicalCollege, CommunityCode, KnowledgeRepositories } from '@/lib/knowledge'
import type { RetrievalEngine } from '@/lib/retrieval'
import { resolveConfig, type DeepPartial, type RecommendationConfig } from '../config'
import { createProfileProvider, nullCutoffLookup, type CutoffLookup, type ProfileProvider } from '../data'
import { createComparisonEngine, type ComparisonEngine } from '../comparison'
import { createEligibilityEngine } from '../eligibility'
import { createReasonGenerator } from '../reasons'
import { createScoringEngine } from '../scoring'
import { strategyFor, type StrategyContext } from '../strategies'
import type {
  ComparisonResult,
  EligibilityCategory,
  RecommendationCategory,
  RecommendationRequest,
  RecommendationResult,
} from '../models'

/** Options for constructing the recommendation engine. */
export interface RecommendationEngineOptions {
  /** Partial config override, deep-merged onto the defaults. */
  readonly config?: DeepPartial<RecommendationConfig>
  /** Historical-cutoff source (defaults to none → eligibility is `unknown`). */
  readonly cutoffs?: CutoffLookup
}

/** Optional per-call refinements shared by most methods. */
export interface RecommendationOptions {
  readonly limit?: number
  readonly branch?: string
  readonly studentCutoff?: number
  readonly community?: CommunityCode
  /** District filter — candidates outside this district are excluded before ranking. */
  readonly district?: string
}

/** The public Recommendation Engine API. */
export interface RecommendationEngine {
  /** The resolved, effective configuration. */
  readonly config: RecommendationConfig
  /** Assembled college profiles (for inspection/tests). */
  readonly profiles: ProfileProvider

  /** Generic dispatch by request category. */
  recommend(request: RecommendationRequest): readonly RecommendationResult[]

  recommendBestCollege(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendBestPlacement(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendBestFaculty(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendBestResearch(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendBestInfrastructure(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendBestROI(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendGovernmentColleges(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendPrivateColleges(options?: RecommendationOptions): readonly RecommendationResult[]
  recommendByBranch(branch: string, options?: RecommendationOptions): readonly RecommendationResult[]
  recommendByCutoff(
    studentCutoff: number,
    community: CommunityCode,
    options?: RecommendationOptions,
  ): readonly RecommendationResult[]
  recommendSafeColleges(
    studentCutoff: number,
    community: CommunityCode,
    options?: RecommendationOptions,
  ): readonly RecommendationResult[]
  recommendDreamColleges(
    studentCutoff: number,
    community: CommunityCode,
    options?: RecommendationOptions,
  ): readonly RecommendationResult[]
  recommendReachColleges(
    studentCutoff: number,
    community: CommunityCode,
    options?: RecommendationOptions,
  ): readonly RecommendationResult[]
  recommendTargetColleges(
    studentCutoff: number,
    community: CommunityCode,
    options?: RecommendationOptions,
  ): readonly RecommendationResult[]

  /** Compare 2+ colleges by name or entity. */
  compareColleges(colleges: readonly (string | CanonicalCollege)[]): ComparisonResult
}

/** Re-number results so ranks are contiguous from 1 after filtering. */
function renumber(results: readonly RecommendationResult[]): readonly RecommendationResult[] {
  return results.map((r, i) => ({ ...r, rank: i + 1 }))
}

/**
 * Create the Recommendation Engine over Phase 1 repositories and the Sprint 2
 * Retrieval Engine.
 */
export function createRecommendationEngine(
  repos: KnowledgeRepositories,
  retrieval: RetrievalEngine,
  options: RecommendationEngineOptions = {},
): RecommendationEngine {
  const config = resolveConfig(options.config)
  const cutoffs = options.cutoffs ?? nullCutoffLookup

  const profiles = createProfileProvider(repos, retrieval, config)
  const scoring = createScoringEngine(config)
  const reasons = createReasonGenerator(config)
  const eligibility = createEligibilityEngine(cutoffs, config)
  const comparison = createComparisonEngine({ profiles, scoring, config })

  const ctx: StrategyContext = { profiles, scoring, reasons, eligibility, cutoffs, config }

  const run = (
    category: RecommendationCategory,
    request: Omit<RecommendationRequest, 'category'>,
  ): readonly RecommendationResult[] => strategyFor(category).recommend(ctx, { category, ...request })

  /** Map the shared per-call options to a category-less request. */
  const forward = (o?: RecommendationOptions): Omit<RecommendationRequest, 'category'> => ({
    limit: o?.limit,
    branch: o?.branch,
    studentCutoff: o?.studentCutoff,
    community: o?.community,
    district: o?.district,
  })

  /** Rank across all colleges by overall quality, then keep one eligibility band. */
  const byBand = (
    studentCutoff: number,
    community: CommunityCode,
    band: EligibilityCategory,
    o?: RecommendationOptions,
  ): readonly RecommendationResult[] => {
    const full = run('by_cutoff', {
      studentCutoff,
      community,
      branch: o?.branch,
      district: o?.district,
      includeIneligible: true, // this method selects the band itself
      limit: Number.MAX_SAFE_INTEGER,
    })
    const filtered = full.filter((r) => r.eligibility?.category === band)
    const limit = o?.limit ?? config.defaultLimit
    return renumber(filtered.slice(0, Math.max(0, limit)))
  }

  const resolveCollege = (input: string | CanonicalCollege): CanonicalCollege | null => {
    if (typeof input !== 'string') return input
    const profile = profiles.getByExactName(input) ?? profiles.findByName(input)
    return profile ? profile.college : null
  }

  return Object.freeze({
    config,
    profiles,

    recommend: (request) => strategyFor(request.category).recommend(ctx, request),

    // Dimension-focused rankings (weights emphasise one axis; see config).
    recommendBestCollege: (o) => run('best_overall', forward(o)),
    recommendBestPlacement: (o) => run('best_placement', forward(o)),
    recommendBestFaculty: (o) => run('best_faculty', forward(o)),
    recommendBestResearch: (o) => run('best_research', forward(o)),
    recommendBestInfrastructure: (o) => run('best_infrastructure', forward(o)),
    recommendBestROI: (o) => run('best_roi', forward(o)),

    // Ownership-filtered rankings.
    recommendGovernmentColleges: (o) => run('government_college', forward(o)),
    recommendPrivateColleges: (o) => run('private_college', forward(o)),

    recommendByBranch: (branch, o) =>
      run('by_branch', { branch, district: o?.district, limit: o?.limit, studentCutoff: o?.studentCutoff, community: o?.community }),

    recommendByCutoff: (studentCutoff, community, o) =>
      run('by_cutoff', { studentCutoff, community, branch: o?.branch, district: o?.district, limit: o?.limit }),

    recommendSafeColleges: (studentCutoff, community, o) => byBand(studentCutoff, community, 'safe', o),
    recommendDreamColleges: (studentCutoff, community, o) => byBand(studentCutoff, community, 'dream', o),
    recommendReachColleges: (studentCutoff, community, o) => byBand(studentCutoff, community, 'reach', o),
    recommendTargetColleges: (studentCutoff, community, o) => byBand(studentCutoff, community, 'target', o),

    compareColleges: (list) => {
      const resolved = list
        .map(resolveCollege)
        .filter((c): c is CanonicalCollege => c !== null)
      return comparison.compare(resolved)
    },
  })
}
