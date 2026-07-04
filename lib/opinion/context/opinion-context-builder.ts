/**
 * @module lib/opinion/context/opinion-context-builder
 *
 * Opinion Context Builder (Module 1). Assembles a structured {@link OpinionContext}
 * — one {@link CollegeDossier} per candidate (placements, faculty, research,
 * finance, location, strengths/weaknesses, historical trend, eligibility, backing
 * evidence ids) plus the missing-information set — from the Sprint 4 context and
 * the Sprint 3 profile provider. It REASONS OVER retrieved evidence only; fees and
 * scholarships are reported as unavailable, never invented. Deterministic; no AI.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type {
  ComparisonResult,
  ProfileProvider,
  RecommendationResult,
  RecommendationScore,
  ScoreDimension,
} from '@/lib/recommendation'
import type {
  ConfidenceLevel,
  ContextPackage,
  MissingInformation,
} from '@/lib/ai/orchestration'
import { SUBSTANTIVE_DIMENSIONS, type OpinionConfig } from '../config'
import type { CollegeDossier, OpinionContext, OpinionStrategy, Priority } from '../models'

/** Dependencies for the context builder. */
export interface OpinionContextDeps {
  readonly profiles: ProfileProvider
  readonly config: OpinionConfig
}

const bandOf = (value: number): ConfidenceLevel => (value >= 0.75 ? 'high' : value >= 0.5 ? 'medium' : 'low')

/** Top/bottom substantive dimensions of a score. */
function rankDimensions(
  score: RecommendationScore,
  topN: number,
  bottomN: number,
): { strengths: ScoreDimension[]; weaknesses: ScoreDimension[] } {
  const withData = score.dimensions.filter(
    (d) => d.hasData && SUBSTANTIVE_DIMENSIONS.includes(d.dimension),
  )
  const byDesc = [...withData].sort((a, b) => b.normalized - a.normalized || a.dimension.localeCompare(b.dimension))
  const strengths = byDesc.slice(0, topN).map((d) => d.dimension)
  const weaknesses = [...withData]
    .sort((a, b) => a.normalized - b.normalized || a.dimension.localeCompare(b.dimension))
    .slice(0, bottomN)
    .map((d) => d.dimension)
    .filter((d) => !strengths.includes(d))
  return { strengths, weaknesses }
}

/** Build the opinion context. */
export function buildOpinionContext(
  deps: OpinionContextDeps,
  input: {
    readonly parsed: {
      readonly studentCutoff: number | null
      readonly community: import('@/lib/knowledge').CommunityCode | null
      readonly branch: string | null
    }
    readonly context: ContextPackage
    readonly strategy: OpinionStrategy
    readonly priorities: readonly Priority[]
  },
): OpinionContext {
  const { profiles, config } = deps
  const { context, strategy, priorities } = input

  // Index the recommendation results + comparison scores by college id.
  const byId = new Map<string, RecommendationResult>()
  for (const r of context.recommendations) byId.set(r.college.id, r)
  const comparison: ComparisonResult | null = context.comparison
  const cmpScore = new Map<string, RecommendationScore>()
  if (comparison) for (const s of comparison.scores) cmpScore.set(s.college.id, s.score)

  // Candidate set: compared colleges for a comparison; else the ranked
  // recommendations; else the named subjects (e.g. "tell me about X"). Capped.
  const candidateColleges: CanonicalCollege[] =
    strategy === 'comparison' && comparison
      ? [...comparison.colleges]
      : context.recommendations.length > 0
        ? context.recommendations.slice(0, config.candidateLimit).map((r) => r.college)
        : [...context.subjects].slice(0, config.candidateLimit)

  const evidenceByCollege = new Map<string, string[]>()
  for (const item of context.evidence.items) {
    if (!item.collegeName) continue
    const list = evidenceByCollege.get(item.collegeName) ?? []
    list.push(item.id)
    evidenceByCollege.set(item.collegeName, list)
  }

  const candidates: CollegeDossier[] = candidateColleges.map((college) => {
    const profile = profiles.getProfile(college)
    const result = byId.get(college.id) ?? null
    const score = result?.score ?? cmpScore.get(college.id) ?? null
    const { strengths, weaknesses } = score
      ? rankDimensions(score, config.strengthsTopN, config.weaknessesBottomN)
      : { strengths: [], weaknesses: [] }

    return {
      college,
      instituteType: profile.instituteType,
      placement: profile.placement,
      faculty: profile.faculty,
      research: profile.research,
      finance: profile.finance,
      fees: null,
      scholarships: null,
      location: college.city ?? college.state ?? null,
      strengths,
      weaknesses,
      trend: profile.placement?.salaryTrend ?? [],
      eligibility: result?.eligibility ?? null,
      overallScore: score?.total ?? 0,
      confidence: result?.confidence.level ?? bandOf(score?.dataCompleteness ?? 0),
      evidenceIds: evidenceByCollege.get(college.name) ?? [],
    }
  })

  // Merge missing-information; budget/location counseling always flags the fee gap.
  const missing: MissingInformation[] = [...context.missingInformation]
  if (
    (strategy === 'budget_focused' || priorities.includes('budget')) &&
    !missing.some((m) => m.field === 'fees_dataset')
  ) {
    missing.push({ field: 'fees_dataset', severity: 'degraded', reason: 'tuition fees are not present in the dataset' })
  }

  return {
    strategy,
    priorities,
    studentCutoff: input.parsed.studentCutoff,
    community: input.parsed.community,
    branch: input.parsed.branch,
    candidates,
    comparison,
    evidence: context.evidence,
    missingInformation: missing,
  }
}
