/**
 * @module lib/opinion/config
 *
 * Central configuration for the Opinion Engine — how many candidates to consider,
 * how many strengths/weaknesses to surface, and the priority→dimension mapping
 * used to order strengths. Nothing downstream is hardcoded. No AI.
 */

import type { ScoreDimension } from '@/lib/recommendation'
import type { Priority } from './models'

/** The complete opinion configuration. */
export interface OpinionConfig {
  readonly candidateLimit: number
  readonly strengthsTopN: number
  readonly weaknessesBottomN: number
  /** The scoring dimension a priority maps to (null = holistic). */
  readonly priorityDimension: Readonly<Record<Priority, ScoreDimension | null>>
}

/** The default configuration. */
export const defaultOpinionConfig: OpinionConfig = {
  candidateLimit: 6,
  strengthsTopN: 2,
  weaknessesBottomN: 2,
  priorityDimension: {
    overall: null,
    placement: 'placement',
    research: 'research',
    faculty: 'faculty',
    // No fees in the dataset — financial strength is only a weak proxy, always
    // accompanied by a "fees unavailable" risk.
    budget: 'financialStrength',
    location: null,
  },
}

/** Resolve a partial override onto the defaults. */
export function resolveOpinionConfig(override?: Partial<OpinionConfig>): OpinionConfig {
  return { ...defaultOpinionConfig, ...override }
}

/** The substantive dimensions used for strengths/weaknesses (meta signals excluded). */
export const SUBSTANTIVE_DIMENSIONS: readonly ScoreDimension[] = [
  'placement',
  'faculty',
  'research',
  'infrastructure',
  'financialStrength',
  'academicReputation',
]
