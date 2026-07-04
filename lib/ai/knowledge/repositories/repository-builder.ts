/**
 * @module lib/ai/knowledge/repositories/repository-builder
 *
 * The builder abstraction that lets a repository be constructed from injected
 * {@link KnowledgeDependencies}. Future modules provide builders for concrete
 * repositories (SQL, document, vector, cache); the factory invokes them with the
 * container-provided dependencies. Type only.
 */

import type { KnowledgeDependencies, KnowledgeRepository } from '../contracts'

/**
 * Constructs a repository from injected dependencies. This is the seam that lets
 * new source types plug in without any existing code changing.
 * @typeParam R The concrete repository type produced.
 */
export type RepositoryBuilder<R extends KnowledgeRepository = KnowledgeRepository> = (
  dependencies: KnowledgeDependencies,
) => R
