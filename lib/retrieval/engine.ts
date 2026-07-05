/**
 * @module lib/retrieval/engine
 *
 * The Structured Retrieval Engine composition root. Wires all services and the
 * search engine over the Phase 1 repositories (Dependency Injection). This is the
 * single entry point future recommendation/opinion layers will consume.
 */

import type { KnowledgeRepositories } from '@/lib/knowledge'
import {
  createBranchService,
  createCollegeService,
  createFinanceService,
  createInstitutionService,
  createPlacementService,
  createResearchService,
  type BranchRetrievalService,
  type CollegeRetrievalService,
  type FinanceRetrievalService,
  type InstitutionRetrievalService,
  type PlacementRetrievalService,
  type ResearchRetrievalService,
} from './services'
import { createSearchEngine, type SearchEngine } from './search'

/** The assembled structured retrieval engine. */
export interface RetrievalEngine {
  readonly colleges: CollegeRetrievalService
  readonly branches: BranchRetrievalService
  readonly institutions: InstitutionRetrievalService
  readonly placements: PlacementRetrievalService
  readonly finance: FinanceRetrievalService
  readonly research: ResearchRetrievalService
  readonly search: SearchEngine
}

/**
 * Create the structured retrieval engine over the Phase 1 repositories.
 * @param repos Repositories from `createRepositories(warehouse)`.
 */
export function createRetrievalEngine(repos: KnowledgeRepositories): RetrievalEngine {
  const placements = createPlacementService(repos)
  const finance = createFinanceService(repos)
  const research = createResearchService(repos)
  const institutions = createInstitutionService(repos, finance, research)
  const colleges = createCollegeService(repos)
  const branches = createBranchService(repos)
  const search = createSearchEngine(repos, { placements, finance, research })

  return Object.freeze({ colleges, branches, institutions, placements, finance, research, search })
}
