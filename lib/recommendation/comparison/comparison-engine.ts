/**
 * @module lib/recommendation/comparison/comparison-engine
 *
 * The College Comparison Engine (Module 5). Compares two OR MORE colleges on the
 * same weighted dimensions used for scoring, and reports: the overall winner, a
 * per-dimension breakdown with a winner for each ("category winners"), the raw
 * differences, and each college's strengths/weaknesses. Reuses the Scoring Engine
 * and Profile Provider — no scoring logic is duplicated. Deterministic; no AI.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { RecommendationConfig } from '../config'
import type { ProfileProvider } from '../data'
import type { ScoringEngine } from '../scoring'
import {
  SCORE_DIMENSIONS,
  type CategoryWinner,
  type CollegeScoreEntry,
  type CollegeStrengths,
  type ComparisonResult,
  type DimensionComparison,
  type DimensionValue,
  type RecommendationScore,
  type ScoreDimension,
} from '../models'

/** Compares colleges across scoring dimensions. */
export interface ComparisonEngine {
  /** Compare 2+ colleges; a single college yields itself as trivial winner. */
  compare(colleges: readonly CanonicalCollege[]): ComparisonResult
}

/** Dependencies for the comparison engine. */
export interface ComparisonDeps {
  readonly profiles: ProfileProvider
  readonly scoring: ScoringEngine
  readonly config: RecommendationConfig
}

interface Entry {
  readonly college: CanonicalCollege
  readonly score: RecommendationScore
  readonly byDimension: ReadonlyMap<ScoreDimension, { normalized: number; raw: number | null; hasData: boolean }>
}

/** Pick the unique argmax over entries with data; `null` on none or a tie. */
function uniqueMaxCollege(
  entries: readonly Entry[],
  dimension: ScoreDimension,
): CanonicalCollege | null {
  let best: Entry | null = null
  let tie = false
  for (const e of entries) {
    const cell = e.byDimension.get(dimension)
    if (!cell || !cell.hasData) continue
    if (best === null) {
      best = e
      tie = false
      continue
    }
    const bestCell = best.byDimension.get(dimension)!
    if (cell.normalized > bestCell.normalized) {
      best = e
      tie = false
    } else if (cell.normalized === bestCell.normalized) {
      tie = true
    }
  }
  return best !== null && !tie ? best.college : null
}

/** Is this college the unique minimum (with data) on the dimension? */
function isUniqueMin(entries: readonly Entry[], dimension: ScoreDimension, college: CanonicalCollege): boolean {
  const withData = entries.filter((e) => e.byDimension.get(dimension)?.hasData)
  if (withData.length < 2) return false
  const values = withData.map((e) => e.byDimension.get(dimension)!.normalized)
  const min = Math.min(...values)
  const self = entries.find((e) => e.college.id === college.id)?.byDimension.get(dimension)
  if (!self || !self.hasData || self.normalized !== min) return false
  return values.filter((v) => v === min).length === 1
}

/** Create the comparison engine. */
export function createComparisonEngine(deps: ComparisonDeps): ComparisonEngine {
  const weights = deps.config.weights

  const compare = (colleges: readonly CanonicalCollege[]): ComparisonResult => {
    const entries: Entry[] = colleges.map((college) => {
      const profile = deps.profiles.getProfile(college)
      const score = deps.scoring.score(profile, weights)
      const byDimension = new Map(
        score.dimensions.map((d) => [
          d.dimension,
          { normalized: d.normalized, raw: d.raw, hasData: d.hasData },
        ]),
      )
      return { college, score, byDimension }
    })

    const scores: CollegeScoreEntry[] = entries.map((e) => ({ college: e.college, score: e.score }))

    // Overall winner: highest total, but a top-two tie means "no clear winner".
    const ranked = [...entries].sort((a, b) => b.score.total - a.score.total)
    const winner =
      ranked.length === 0
        ? null
        : ranked.length >= 2 && ranked[0].score.total === ranked[1].score.total
          ? null
          : ranked[0].college

    const dimensions: DimensionComparison[] = SCORE_DIMENSIONS.map((dimension) => {
      const values: DimensionValue[] = entries.map((e) => {
        const cell = e.byDimension.get(dimension)!
        return { college: e.college, normalized: cell.normalized, raw: cell.raw, hasData: cell.hasData }
      })
      return { dimension, winner: uniqueMaxCollege(entries, dimension), values }
    })

    const categoryWinners: CategoryWinner[] = dimensions.map((d) => ({
      dimension: d.dimension,
      winner: d.winner,
    }))

    const profiles: CollegeStrengths[] = entries.map((e) => ({
      college: e.college,
      strengths: dimensions
        .filter((d) => d.winner !== null && d.winner.id === e.college.id)
        .map((d) => d.dimension),
      weaknesses: SCORE_DIMENSIONS.filter((dim) => isUniqueMin(entries, dim, e.college)),
    }))

    return { colleges, winner, scores, dimensions, categoryWinners, profiles }
  }

  return Object.freeze({ compare })
}
