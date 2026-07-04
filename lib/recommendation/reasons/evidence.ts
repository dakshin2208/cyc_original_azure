/**
 * @module lib/recommendation/reasons/evidence
 *
 * Deterministic extraction of concrete supporting facts per dimension, straight
 * from the retrieval summaries. Every value is a real number/string from the
 * warehouse (or `null`) — no interpretation, no prose.
 */

import type { CollegeProfile, RecommendationEvidence, ScoreDimension } from '../models'

/** Build the evidence list for one dimension from the profile. */
export function evidenceFor(
  dimension: ScoreDimension,
  profile: CollegeProfile,
): readonly RecommendationEvidence[] {
  const ev: RecommendationEvidence[] = []
  const push = (label: string, value: string | number | null, source: string): void => {
    ev.push({ dimension, label, value, source })
  }

  switch (dimension) {
    case 'placement': {
      const p = profile.placement
      push('Median salary (INR/yr)', p?.medianSalary ?? null, 'placement')
      push('Placement rate (%)', p?.placementPercentage ?? null, 'placement')
      push('Highest median salary (INR/yr)', p?.highestMedianSalary ?? null, 'placement')
      push('Latest cohort', p?.latestYear ?? null, 'placement')
      break
    }
    case 'faculty': {
      const f = profile.faculty
      push('Total faculty', f?.total ?? null, 'faculty')
      push('Faculty with PhD', f?.withPhd ?? null, 'faculty')
      push('Currently working', f?.currentlyWorking ?? null, 'faculty')
      break
    }
    case 'research': {
      const r = profile.research
      push('Patents published', r?.patentsPublished ?? null, 'research')
      push('Sponsored projects', r?.sponsoredProjects ?? null, 'research')
      push('PhDs graduated', r?.phdGraduated ?? null, 'research')
      break
    }
    case 'infrastructure': {
      const fin = profile.finance
      push('Capital expenditure (INR)', fin?.capitalExpenditure ?? null, 'finance')
      push('Library spend (INR)', fin?.library ?? null, 'finance')
      push('Lab/equipment spend (INR)', fin?.labs ?? null, 'finance')
      break
    }
    case 'financialStrength': {
      const fin = profile.finance
      push('Operating expenditure (INR)', fin?.operatingExpenditure ?? null, 'finance')
      break
    }
    case 'academicReputation': {
      const i = profile.institution
      push('PhD scholars (full-time)', i?.phdFulltimePursuing ?? null, 'nirf')
      push('PhD scholars (part-time)', i?.phdParttimePursuing ?? null, 'nirf')
      push('NIRF category', i?.category ?? null, 'nirf')
      break
    }
    case 'nirfPresence': {
      push('NIRF ranked', profile.college.hasNirfData ? 'yes' : 'no', 'college')
      push('NIRF id', profile.college.nirfId, 'college')
      break
    }
    case 'availableBranches': {
      // No per-college branch linkage in the warehouse (Knowledge Audit).
      push('Branches linked', null, 'unavailable')
      break
    }
    case 'dataCompleteness': {
      push('Has placement data', profile.placement ? 'yes' : 'no', 'warehouse')
      push('Has finance data', profile.finance ? 'yes' : 'no', 'warehouse')
      push('Has research data', profile.research ? 'yes' : 'no', 'warehouse')
      push('Has faculty data', profile.faculty ? 'yes' : 'no', 'warehouse')
      push('Has NIRF data', profile.institution ? 'yes' : 'no', 'warehouse')
      break
    }
  }
  return ev
}
