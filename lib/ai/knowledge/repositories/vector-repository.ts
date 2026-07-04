/**
 * @module lib/ai/knowledge/repositories/vector-repository
 *
 * Placeholder contract reserving the shape of a vector-backed repository. It
 * extends the base {@link KnowledgeRepository} so vector sources are reachable
 * through the same interface as everything else.
 *
 * Deliberately adds NO vector-specific operations: embeddings, similarity, and
 * semantic search are explicitly out of scope for this sprint and will be
 * introduced by a dedicated future module.
 */

import type { KnowledgeRepository } from '../contracts'

/**
 * A repository backed by a vector store. Reserved placeholder — no additional
 * members until the vector module is built.
 * @typeParam T The content type of returned records.
 */
export type VectorRepository<T = unknown> = KnowledgeRepository<T>
