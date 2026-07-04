/**
 * @module lib/ai/chat/profile/profile-store
 *
 * Persists a {@link StudentProfile} per conversation. ASYNC (like the session
 * store) so it can later be backed by Redis with no service change. In-memory,
 * bounded, request/session-scoped — no database. Separate from the conversation-
 * state store so that store (and its tests) are untouched.
 */

import type { StudentProfile } from './student-profile'

/** A replaceable per-conversation profile store (in-memory now, Redis later). */
export interface ProfileStore {
  get(conversationId: string): Promise<StudentProfile | undefined>
  set(conversationId: string, profile: StudentProfile): Promise<void>
  delete(conversationId: string): Promise<void>
  size(): Promise<number>
}

/** Options for the in-memory profile store. */
export interface InMemoryProfileStoreOptions {
  /** Maximum retained profiles; oldest evicted first (default 1000). */
  readonly maxEntries?: number
}

/** Create an in-memory profile store (Map-backed, bounded, LRU eviction). */
export function createInMemoryProfileStore(options: InMemoryProfileStoreOptions = {}): ProfileStore {
  const maxEntries = options.maxEntries ?? 1000
  const map = new Map<string, StudentProfile>()

  const touch = (id: string, profile: StudentProfile): void => {
    map.delete(id)
    map.set(id, profile)
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value
      if (oldest === undefined) break
      map.delete(oldest)
    }
  }

  return Object.freeze({
    get: async (id) => {
      const value = map.get(id)
      if (value !== undefined) touch(id, value)
      return value
    },
    set: async (id, profile) => void touch(id, profile),
    delete: async (id) => void map.delete(id),
    size: async () => map.size,
  })
}
