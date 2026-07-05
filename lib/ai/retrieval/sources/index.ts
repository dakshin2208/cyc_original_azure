/**
 * @module lib/ai/retrieval/sources
 * Barrel for knowledge-source contracts (Module 2).
 */
export { REPOSITORY_KINDS } from './repository-kind'
export type { RepositoryKind } from './repository-kind'
export type {
  CollegeContent,
  BranchContent,
  CutoffContent,
  StatisticsContent,
  FeeContent,
  DocumentContent,
} from './content'
export type {
  CollegeRepository,
  BranchRepository,
  CutoffRepository,
  StatisticsRepository,
  FeeRepository,
  DocumentRepository,
  SqlRepository,
} from './domain-repositories'
