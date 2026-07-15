/**
 * @module lib/ai/tools/recommendation-tools
 *
 * The recommendation / retrieval capabilities as generic {@link Tool}s (Commit 3).
 * Each tool is a THIN mapping from LLM args to a neutral {@link ToolResult}; the
 * EXISTING pipeline (OpinionService → Recommendation Engine → Retrieval → Evidence →
 * Validator → Formatter) does all the work. No business logic, SQL, scoring, or
 * ranking is reimplemented here — a `route` result is exactly a user typing that
 * message, and a `recommend` result carries profile overrides into the same engine.
 */

import { normalizeCommunity } from '@/lib/knowledge'
import { asNumber, asString, asStringArray, type RecommendArgs, type Tool } from './tool'

/** Build a RecommendArgs from optional coerced fields (only present fields are set). */
function recommendArgs(fields: {
  cutoff?: number | null
  community?: RecommendArgs['community'] | null
  district?: string | null
  branch?: string | null
}): RecommendArgs {
  return {
    ...(fields.cutoff != null ? { cutoff: fields.cutoff } : {}),
    ...(fields.community != null ? { community: fields.community } : {}),
    ...(fields.district != null ? { district: fields.district } : {}),
    ...(fields.branch != null ? { branch: fields.branch } : {}),
  }
}

export const recommendationTools: readonly Tool[] = [
  {
    name: 'recommend_by_cutoff',
    description: 'Recommend colleges the student can realistically get for their cutoff and community, with eligibility banding. Requires cutoff AND community.',
    parameters: {
      cutoff: 'TNEA cutoff out of 200 (number)',
      community: 'one of OC, BC, BCM, MBC, SC, SCA, ST',
      district: 'optional Tamil Nadu district',
      branch: 'optional engineering branch',
    },
    execute: (args) => {
      const cutoff = asNumber(args.cutoff)
      const communityRaw = asString(args.community)
      const community = communityRaw ? normalizeCommunity(communityRaw) : null
      // Required args missing → decline so the deterministic path collects them (community gate).
      if (cutoff === null || community === null) return null
      return {
        kind: 'recommend',
        args: recommendArgs({ cutoff, community, district: asString(args.district), branch: asString(args.branch) }),
      }
    },
  },
  {
    name: 'recommend_best_college',
    description: 'Recommend the best overall colleges (optionally scoped to a district or branch).',
    parameters: { district: 'optional district', branch: 'optional branch' },
    execute: (args) => ({
      kind: 'recommend',
      args: recommendArgs({ district: asString(args.district), branch: asString(args.branch) }),
    }),
  },
  {
    name: 'recommend_by_branch',
    description: 'Recommend the best colleges for a specific engineering branch.',
    parameters: { branch: 'the engineering branch', district: 'optional district' },
    execute: (args) => {
      const branch = asString(args.branch)
      if (!branch) return null
      return { kind: 'recommend', args: recommendArgs({ branch, district: asString(args.district) }) }
    },
  },
  {
    name: 'compare_colleges',
    description: 'Compare two named colleges head to head.',
    parameters: { colleges: 'array of exactly two college names' },
    execute: (args) => {
      const cols = asStringArray(args.colleges)
      if (cols.length < 2) return null
      return { kind: 'route', message: `compare ${cols[0]} and ${cols[1]}`, needsCollege: true }
    },
  },
  {
    name: 'college_details',
    description: 'Give an overview / opinion of one named college.',
    parameters: { college: 'the college name' },
    execute: (args) => {
      const c = asString(args.college)
      return c ? { kind: 'route', message: `tell me about ${c}`, needsCollege: true } : null
    },
  },
  {
    name: 'placement_query',
    description: 'Placements — for a named college, or the best-placement colleges overall.',
    parameters: { college: 'optional college name' },
    execute: (args) => {
      const c = asString(args.college)
      return c
        ? { kind: 'route', message: `what are the placements at ${c}`, needsCollege: true }
        : { kind: 'route', message: 'which colleges have the best placements', needsCollege: false }
    },
  },
  {
    name: 'ranking_query',
    description: 'The best / top colleges by overall ranking.',
    parameters: {},
    execute: () => ({ kind: 'route', message: 'which are the best colleges overall', needsCollege: false }),
  },
  {
    name: 'branch_guidance',
    description: 'Guidance on engineering branches — a specific branch, or the best branch overall.',
    parameters: { branch: 'optional engineering branch' },
    execute: (args) => {
      const b = asString(args.branch)
      return b
        ? { kind: 'route', message: `is ${b} a good engineering branch`, needsCollege: false }
        : { kind: 'route', message: 'which engineering branch has the best future', needsCollege: false }
    },
  },
  {
    name: 'college_listing',
    description: 'List N colleges in a city (a plain directory, optionally by branch). No profile needed.',
    parameters: { city: 'the city/district', count: 'how many (default 10)', branch: 'optional branch' },
    execute: (args) => {
      const city = asString(args.city)
      if (!city) return null
      return { kind: 'list', city, count: asNumber(args.count) ?? 10, branch: asString(args.branch) }
    },
  },
]
