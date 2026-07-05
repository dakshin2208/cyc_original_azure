/**
 * @module lib/retrieval/search/search-engine
 *
 * Search Engine (Sprint 2 §7). Deterministic exact/prefix/partial/fuzzy search
 * over each entity via the shared ranker. Placement/finance/research searches
 * find colleges by name and attach the corresponding computed summary.
 */

import type {
  CanonicalBranch,
  CanonicalCollege,
  CanonicalFaculty,
  CanonicalInstitution,
  KnowledgeRepositories,
} from '@/lib/knowledge'
import type {
  CollegeFinanceView,
  CollegePlacementView,
  CollegeResearchView,
  RankedMatch,
  SearchResult,
} from '../models'
import { rankCandidates } from '../ranking'
import type { FinanceRetrievalService } from '../services/finance-service'
import type { PlacementRetrievalService } from '../services/placement-service'
import type { ResearchRetrievalService } from '../services/research-service'

/** Deterministic full-entity search. */
export interface SearchEngine {
  searchCollege(query: string, limit?: number): SearchResult<CanonicalCollege>
  searchBranch(query: string, limit?: number): SearchResult<CanonicalBranch>
  searchInstitution(query: string, limit?: number): SearchResult<CanonicalInstitution>
  searchFaculty(query: string, limit?: number): SearchResult<CanonicalFaculty>
  searchPlacement(query: string, limit?: number): SearchResult<CollegePlacementView>
  searchFinance(query: string, limit?: number): SearchResult<CollegeFinanceView>
  searchResearch(query: string, limit?: number): SearchResult<CollegeResearchView>
}

/** Fact services the search engine enriches college matches with. */
export interface SearchFactServices {
  readonly placements: PlacementRetrievalService
  readonly finance: FinanceRetrievalService
  readonly research: ResearchRetrievalService
}

const DEFAULT_LIMIT = 10

function toResult<T>(query: string, matches: readonly RankedMatch<T>[]): SearchResult<T> {
  return { query, matches, total: matches.length }
}

/** Create the search engine over the Phase 1 repositories and fact services. */
export function createSearchEngine(
  repos: KnowledgeRepositories,
  facts: SearchFactServices,
): SearchEngine {
  const collegeMatches = (query: string, limit: number) =>
    rankCandidates(query, repos.colleges.list(), { name: (c) => c.name, limit })

  const enrich = <V>(
    query: string,
    limit: number,
    map: (college: CanonicalCollege) => V,
  ): SearchResult<V> => {
    const matches = collegeMatches(query, limit).map<RankedMatch<V>>((m) => ({
      item: map(m.item),
      label: m.label,
      score: m.score,
      matchType: m.matchType,
    }))
    return toResult(query, matches)
  }

  return Object.freeze({
    searchCollege: (query, limit = DEFAULT_LIMIT) => toResult(query, collegeMatches(query, limit)),

    searchBranch: (query, limit = DEFAULT_LIMIT) =>
      toResult(
        query,
        rankCandidates(query, repos.branches.list(), {
          name: (b) => b.canonicalName,
          aliases: (b) => b.aliases,
          limit,
        }),
      ),

    searchInstitution: (query, limit = DEFAULT_LIMIT) =>
      toResult(query, rankCandidates(query, repos.institutions.list(), { name: (i) => i.name, limit })),

    searchFaculty: (query, limit = DEFAULT_LIMIT) =>
      toResult(query, rankCandidates(query, repos.faculty.list(), { name: (f) => f.name, limit })),

    searchPlacement: (query, limit = DEFAULT_LIMIT) =>
      enrich(query, limit, (college) => ({ college, placement: facts.placements.getSummary(college.id) })),

    searchFinance: (query, limit = DEFAULT_LIMIT) =>
      enrich(query, limit, (college) => ({ college, finance: facts.finance.getSummary(college.id) })),

    searchResearch: (query, limit = DEFAULT_LIMIT) =>
      enrich(query, limit, (college) => ({ college, research: facts.research.getSummary(college.id) })),
  })
}
