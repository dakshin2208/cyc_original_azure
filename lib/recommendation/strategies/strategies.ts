/**
 * @module lib/recommendation/strategies/strategies
 *
 * The Recommendation Strategies (Module 4). Each strategy is a thin, config-driven
 * object: it declares a category, pulls its weight profile from config, optionally
 * filters the candidate set, and attaches honest caveats — then delegates the
 * ranking pipeline to the shared executor (no duplicated logic). Every strategy
 * returns ranked colleges with reasoning + confidence + evidence. No AI.
 */

import type { CollegeProfile, RecommendationCategory, RecommendationRequest, RecommendationResult } from '../models'
import { rankProfiles, type RankSpec, type StrategyContext } from './executor'

/** A named ranking strategy. */
export interface Strategy {
  readonly category: RecommendationCategory
  recommend(ctx: StrategyContext, request: RecommendationRequest): readonly RecommendationResult[]
}

interface StrategyOptions {
  readonly accepts?: (profile: CollegeProfile) => boolean
  readonly requires?: RankSpec['requires']
  readonly notes?: readonly string[]
}

/** Build a strategy whose weights come from `config.strategyWeights[category]`. */
function makeStrategy(category: RecommendationCategory, options: StrategyOptions = {}): Strategy {
  return Object.freeze({
    category,
    recommend: (ctx, request) => {
      const spec: RankSpec = {
        category,
        weights: ctx.config.strategyWeights[category],
        accepts: options.accepts,
        requires: options.requires,
        notes: options.notes,
      }
      return rankProfiles(ctx, spec, request)
    },
  })
}

const isPrivate = (p: CollegeProfile): boolean => p.instituteType === 'private'
const isGovernment = (p: CollegeProfile): boolean => p.instituteType === 'government'

const ROI_NOTE = 'ROI is approximated from placement outcomes; tuition fees are not present in the dataset.'
const BRANCH_NOTE =
  'Branch-level filtering is unavailable (no per-college branch linkage in the warehouse); ranked across all colleges.'
const CUTOFF_NOTE =
  'Ranked by overall quality; per-college eligibility is annotated when a closing-cutoff dataset is available.'
const focusNote = (dimension: string): string =>
  `Only colleges with ${dimension} data are ranked here (no evidence ⇒ not ranked on this axis).`

/** The ten core strategies, keyed by category. */
export const STRATEGIES: Readonly<Record<RecommendationCategory, Strategy>> = {
  best_overall: makeStrategy('best_overall'),
  best_placement: makeStrategy('best_placement', {
    requires: ['placement'],
    notes: [focusNote('placement')],
  }),
  best_research: makeStrategy('best_research', {
    requires: ['research'],
    notes: [focusNote('research')],
  }),
  best_faculty: makeStrategy('best_faculty', {
    requires: ['faculty'],
    notes: [focusNote('faculty')],
  }),
  best_infrastructure: makeStrategy('best_infrastructure', {
    requires: ['infrastructure'],
    notes: [focusNote('infrastructure (capital expenditure)')],
  }),
  best_roi: makeStrategy('best_roi', { requires: ['placement'], notes: [ROI_NOTE] }),
  higher_studies: makeStrategy('higher_studies'),
  government_jobs: makeStrategy('government_jobs'),
  private_college: makeStrategy('private_college', { accepts: isPrivate }),
  government_college: makeStrategy('government_college', { accepts: isGovernment }),
  // Facade-oriented categories (branch/cutoff context); included so the registry
  // covers every category and the generic `recommend(request)` path is total.
  by_branch: makeStrategy('by_branch', { notes: [BRANCH_NOTE] }),
  by_cutoff: makeStrategy('by_cutoff', { notes: [CUTOFF_NOTE] }),
}

/** Resolve the strategy for a category. */
export function strategyFor(category: RecommendationCategory): Strategy {
  return STRATEGIES[category]
}
