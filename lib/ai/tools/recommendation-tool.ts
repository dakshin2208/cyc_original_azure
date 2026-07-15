/**
 * @module lib/ai/tools/recommendation-tool
 *
 * Deliverable 3 — the recommendation tool wrapper.
 *
 * A THIN adapter that turns a validated {@link ToolRequest} into a call on the
 * EXISTING recommendation engine and returns structured facts. It reuses
 * {@link RecommendationEngine.recommendByCutoff} verbatim — no business logic,
 * scoring, eligibility banding, or SQL is reimplemented here. The output is a
 * serializable facts object (no prose): the second LLM call (Commit 2) will
 * reason over exactly this.
 */

import type { CommunityCode } from '@/lib/knowledge'
import type { RecommendationEngine, RecommendationResult } from '@/lib/recommendation'
import type { ToolRequest } from './tool-request'

/** One college as a structured fact (no narration). */
export interface CollegeFact {
  readonly name: string
  readonly rank: number
  /** Eligibility band from the engine: safe | target | reach | dream | unknown. */
  readonly eligibility: string
  readonly closingCutoff: number | null
  readonly margin: number | null
}

/** The structured facts returned by the recommendation tool. */
export interface RecommendationFacts {
  readonly tool: 'recommend_by_cutoff'
  readonly query: {
    readonly cutoff: number
    readonly community: CommunityCode
    readonly district: string | null
    readonly branch: string | null
  }
  readonly count: number
  readonly colleges: readonly CollegeFact[]
}

const toFact = (r: RecommendationResult): CollegeFact => ({
  name: r.college.name,
  rank: r.rank,
  eligibility: r.eligibility?.category ?? 'unknown',
  closingCutoff: r.eligibility?.closingCutoff ?? null,
  margin: r.eligibility?.margin ?? null,
})

/** Execute `recommend_by_cutoff` against the existing engine and return facts. */
export function executeRecommendByCutoff(
  reco: RecommendationEngine,
  request: ToolRequest,
): RecommendationFacts {
  const { cutoff, community, district, branch, limit } = request.arguments
  const results = reco.recommendByCutoff(cutoff, community, {
    district: district ?? undefined,
    branch: branch ?? undefined,
    limit: limit ?? undefined,
  })
  return {
    tool: 'recommend_by_cutoff',
    query: { cutoff, community, district, branch },
    count: results.length,
    colleges: results.map(toFact),
  }
}
