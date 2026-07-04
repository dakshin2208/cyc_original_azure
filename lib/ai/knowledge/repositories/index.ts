/**
 * @module lib/ai/knowledge/repositories
 * Barrel for the repository pattern: placeholders, builder, and factory.
 */
export type { VectorRepository } from './vector-repository'
export type { CacheRepository } from './cache-repository'
export type { RepositoryBuilder } from './repository-builder'
export type { RepositoryFactory } from './repository-factory'
export { createRepositoryFactory } from './repository-factory'
