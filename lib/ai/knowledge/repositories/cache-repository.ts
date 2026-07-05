/**
 * @module lib/ai/knowledge/repositories/cache-repository
 *
 * Placeholder contract reserving the shape of a cache-backed repository, so a
 * cache source is reachable through the same {@link KnowledgeRepository}
 * interface as any other source.
 *
 * Deliberately adds NO cache-specific operations (set/invalidate/TTL): caching
 * behavior is out of scope for this sprint and will be introduced by a dedicated
 * future module.
 */

import type { KnowledgeRepository } from '../contracts'

/**
 * A repository backed by a cache. Reserved placeholder — no additional members
 * until the cache module is built.
 * @typeParam T The content type of returned records.
 */
export type CacheRepository<T = unknown> = KnowledgeRepository<T>
