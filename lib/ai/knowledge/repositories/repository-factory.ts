/**
 * @module lib/ai/knowledge/repositories/repository-factory
 *
 * The Repository Factory: instantiates repositories by injecting the
 * container-provided {@link KnowledgeDependencies} into a {@link RepositoryBuilder}.
 * This is the single place dependencies are supplied to repositories — callers
 * never wire infrastructure into a repository themselves (Dependency Inversion).
 */

import type { KnowledgeDependencies, KnowledgeRepository } from '../contracts'
import type { RepositoryBuilder } from './repository-builder'

/** Builds concrete repositories from their builders, injecting dependencies. */
export interface RepositoryFactory {
  /**
   * Instantiate a repository from its builder.
   * @param builder The repository builder.
   * @typeParam R The concrete repository type produced.
   */
  build<R extends KnowledgeRepository>(builder: RepositoryBuilder<R>): R
}

/**
 * Create a {@link RepositoryFactory} bound to a set of dependencies. Every
 * repository it builds receives exactly these dependencies.
 *
 * @param dependencies The injected infrastructure (from the runtime container).
 */
export function createRepositoryFactory(dependencies: KnowledgeDependencies): RepositoryFactory {
  return Object.freeze({
    build<R extends KnowledgeRepository>(builder: RepositoryBuilder<R>): R {
      return builder(dependencies)
    },
  })
}
