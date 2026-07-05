/**
 * @module lib/recommendation/eligibility/eligibility-engine
 *
 * The Eligibility Engine (Module 3). Classifies a college as Dream / Reach /
 * Target / Safe for a student, from the student's cutoff mark and the historical
 * closing cutoff for their community (and branch, when known). Closing cutoffs
 * come from an injected {@link CutoffLookup}; when none is available the engine
 * degrades gracefully to `unknown` rather than guessing. Thresholds come from
 * config — nothing hardcoded. Deterministic; no AI.
 *
 * Banding (margin = studentCutoff − closingCutoff):
 *   margin ≥ safeMargin        → safe    (comfortably above the closing cutoff)
 *   0 ≤ margin < safeMargin     → target  (above, but within the safe margin)
 *   −reachMargin ≤ margin < 0   → reach   (just below — a realistic stretch)
 *   margin < −reachMargin       → dream   (well below the closing cutoff)
 */

import type { CanonicalCollege, CommunityCode } from '@/lib/knowledge'
import type { RecommendationConfig } from '../config'
import type { CutoffLookup } from '../data'
import type { EligibilityAssessment, EligibilityCategory } from '../models'

/** Inputs for a single eligibility assessment. */
export interface EligibilityInput {
  readonly college: CanonicalCollege
  /** The student's cutoff mark. */
  readonly studentCutoff: number
  /** The student's reservation community. */
  readonly community: CommunityCode
  /** Branch context (canonical or raw name), when supplied. */
  readonly branch?: string
}

/** Classifies colleges into eligibility bands for a student. */
export interface EligibilityEngine {
  assess(input: EligibilityInput): EligibilityAssessment
}

function band(margin: number, safeMargin: number, reachMargin: number): EligibilityCategory {
  if (margin >= safeMargin) return 'safe'
  if (margin >= 0) return 'target'
  if (margin >= -reachMargin) return 'reach'
  return 'dream'
}

/** Create the eligibility engine over an injected cutoff source. */
export function createEligibilityEngine(
  cutoffs: CutoffLookup,
  config: RecommendationConfig,
): EligibilityEngine {
  const { safeMargin, reachMargin } = config.eligibility

  return Object.freeze({
    assess: (input: EligibilityInput): EligibilityAssessment => {
      const { college, studentCutoff, community, branch } = input
      const closingCutoff = cutoffs.getClosingCutoff({ college, community, branch })

      if (closingCutoff === null) {
        return {
          category: 'unknown',
          studentCutoff,
          closingCutoff: null,
          margin: null,
          hasData: false,
          basis: 'no_closing_cutoff_available',
        }
      }

      const margin = studentCutoff - closingCutoff
      return {
        category: band(margin, safeMargin, reachMargin),
        studentCutoff,
        closingCutoff,
        margin,
        hasData: true,
        basis: `margin=${margin.toFixed(2)};safe>=${safeMargin};reach>=-${reachMargin}`,
      }
    },
  })
}
