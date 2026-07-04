/**
 * @module lib/knowledge/repositories
 * Barrel for repository contracts and their in-memory implementations.
 */
export type {
  CollegeRepository,
  BranchRepository,
  CommunityRepository,
  InstitutionRepository,
  PlacementRepository,
  FacultyRepository,
  ResearchRepository,
  FinanceRepository,
  KnowledgeRepositories,
} from './repository-interfaces'
export { createRepositories } from './in-memory-repositories'
