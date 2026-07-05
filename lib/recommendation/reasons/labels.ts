/**
 * @module lib/recommendation/reasons/labels
 *
 * Closed vocabularies for STRUCTURED explanations. These are short machine labels
 * (not prose) — a future LLM renders them into natural language; the engine only
 * emits the structure. Nothing here reasons or generates free text.
 */

import type { RecommendationCategory, ReasonStrength, ScoreDimension } from '../models'

/** Human-facing short label per scoring dimension. */
export const DIMENSION_LABEL: Readonly<Record<ScoreDimension, string>> = {
  placement: 'Placements',
  faculty: 'Faculty',
  research: 'Research',
  infrastructure: 'Infrastructure',
  financialStrength: 'Financial strength',
  academicReputation: 'Academic reputation',
  selectivity: 'Selectivity',
  nirfPresence: 'NIRF recognition',
  availableBranches: 'Branch availability',
  dataCompleteness: 'Data completeness',
}

/** Strength-qualified summary per dimension (indexed by strength band). */
export const DIMENSION_SUMMARY: Readonly<
  Record<ScoreDimension, Readonly<Record<ReasonStrength, string>>>
> = {
  placement: { strong: 'Excellent placements', moderate: 'Solid placements', weak: 'Modest placements' },
  faculty: { strong: 'Outstanding faculty', moderate: 'Strong faculty', weak: 'Adequate faculty' },
  research: { strong: 'Prolific research output', moderate: 'Active research', weak: 'Limited research' },
  infrastructure: {
    strong: 'Top-tier infrastructure',
    moderate: 'Good infrastructure',
    weak: 'Basic infrastructure',
  },
  financialStrength: {
    strong: 'Very strong finances',
    moderate: 'Healthy finances',
    weak: 'Modest finances',
  },
  academicReputation: {
    strong: 'Highly reputed academically',
    moderate: 'Well regarded academically',
    weak: 'Emerging academic profile',
  },
  selectivity: {
    strong: 'Highly selective admissions',
    moderate: 'Competitive admissions',
    weak: 'Accessible admissions',
  },
  nirfPresence: {
    strong: 'NIRF-ranked institution',
    moderate: 'NIRF-ranked institution',
    weak: 'Not NIRF-ranked',
  },
  availableBranches: {
    strong: 'Wide branch choice',
    moderate: 'Several branches',
    weak: 'Few branches',
  },
  dataCompleteness: {
    strong: 'Comprehensive data coverage',
    moderate: 'Good data coverage',
    weak: 'Sparse data coverage',
  },
}

/** Headline per recommendation category. */
export const CATEGORY_HEADLINE: Readonly<Record<RecommendationCategory, string>> = {
  best_overall: 'Best overall fit',
  best_placement: 'Best for placements',
  best_research: 'Best for research',
  best_faculty: 'Best for faculty',
  best_infrastructure: 'Best for infrastructure',
  best_roi: 'Best return on investment',
  higher_studies: 'Best for higher studies',
  government_jobs: 'Best for government-job preparation',
  private_college: 'Top private college',
  government_college: 'Top government college',
  by_branch: 'Recommended for this branch',
  by_cutoff: 'Recommended for this cutoff',
}
