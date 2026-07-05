/**
 * @module lib/opinion/strategy/opinion-strategy
 *
 * Recommendation Strategy (Module 2). Maps the parsed query intent + entities +
 * caller priorities to an {@link OpinionStrategy} and a priority ordering. Pure and
 * deterministic; it decides HOW to counsel, not WHAT the facts are.
 */

import type { ParsedQuery } from '@/lib/ai/orchestration'
import type { OpinionStrategy, Priority } from '../models'

/** The selected strategy + priorities. */
export interface StrategySelection {
  readonly strategy: OpinionStrategy
  readonly priorities: readonly Priority[]
}

const INTENT_STRATEGY: Partial<Record<ParsedQuery['intent'], OpinionStrategy>> = {
  compare_colleges: 'comparison',
  eligibility_query: 'eligibility_bands',
  cutoff_query: 'eligibility_bands',
  placement_query: 'placement_focused',
  research_query: 'research_focused',
  faculty_query: 'faculty_focused',
  roi_query: 'budget_focused',
  branch_advice: 'branch_recommendation',
  recommend_college: 'college_recommendation',
  nirf_query: 'general_counseling',
  general_information: 'general_counseling',
  unknown: 'general_counseling',
}

const INTENT_PRIORITY: Partial<Record<ParsedQuery['intent'], Priority>> = {
  placement_query: 'placement',
  research_query: 'research',
  faculty_query: 'faculty',
  roi_query: 'budget',
}

/** Select the counseling strategy + priorities for a parsed query. */
export function selectStrategy(parsed: ParsedQuery, overridePriorities?: readonly Priority[]): StrategySelection {
  // Two or more named colleges is always a comparison, regardless of intent.
  let strategy: OpinionStrategy =
    parsed.hasMultipleColleges ? 'comparison' : INTENT_STRATEGY[parsed.intent] ?? 'general_counseling'
  // A college recommendation scoped to a named branch is branch advice (we have
  // no per-college branch data, so it carries a branch-data caveat).
  if (strategy === 'college_recommendation' && parsed.branch) strategy = 'branch_recommendation'

  const priorities = new Set<Priority>(overridePriorities ?? [])
  const intentPriority = INTENT_PRIORITY[parsed.intent]
  if (intentPriority) priorities.add(intentPriority)
  if (parsed.location) priorities.add('location')
  if (parsed.entities.some((e) => e.type === 'fees' || e.type === 'scholarship')) priorities.add('budget')
  if (priorities.size === 0) priorities.add('overall')

  return { strategy, priorities: [...priorities] }
}
