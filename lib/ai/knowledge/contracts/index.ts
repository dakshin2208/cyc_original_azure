/**
 * @module lib/ai/knowledge/contracts
 * Barrel for the core, source-agnostic knowledge contracts.
 */
export type { KnowledgeSourceId, KnowledgeRecordId, KnowledgeSourceType } from './identifiers'
export type { KnowledgeSource } from './source'
export type { KnowledgeRecord } from './record'
export type {
  SortDirection,
  SortSpec,
  KnowledgeFilter,
  Pagination,
  KnowledgeQuery,
} from './query'
export type { KnowledgeResult, RepositoryResult } from './result'
export type { KnowledgeDependencies } from './dependencies'
export type { KnowledgeRepository } from './repository'
export {
  SourceNotFoundError,
  SourceAlreadyRegisteredError,
  SourceUnavailableError,
  RepositoryError,
  QueryError,
  type KnowledgeError,
} from './errors'
