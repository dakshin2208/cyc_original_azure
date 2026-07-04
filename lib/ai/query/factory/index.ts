/**
 * @module lib/ai/query/factory
 * Barrel for the query factory, builder, and understanding contract (Module 10).
 */
export type { QueryDependencies } from './dependencies'
export { QueryBuilder, createQueryBuilder } from './query-builder'
export type { QueryFactory } from './query-factory'
export { createQueryFactory } from './query-factory'
export type {
  RawQueryInput,
  QueryUnderstandingResult,
  QueryUnderstandingComponents,
  QueryUnderstanding,
} from './understanding'
