/**
 * @module lib/ai/chat/session-store
 *
 * Session store for conversation state. The interface is ASYNC so it can later be
 * backed by Redis (or any remote store) with no change to the chat service. This
 * sprint ships only an in-memory Map implementation with an optional LRU-style
 * cap; there is NO database. Request/session scoped only. No AI.
 */

import type { ConversationState } from '@/lib/ai/orchestration'

/** A replaceable conversation-state store (in-memory now, Redis later). */
export interface SessionStore {
  get(conversationId: string): Promise<ConversationState | undefined>
  set(conversationId: string, state: ConversationState): Promise<void>
  has(conversationId: string): Promise<boolean>
  delete(conversationId: string): Promise<void>
  /** Current entry count (diagnostics). */
  size(): Promise<number>
}

/** Options for the in-memory store. */
export interface InMemoryStoreOptions {
  /** Maximum retained conversations; oldest are evicted first (default 1000). */
  readonly maxEntries?: number
}

/** Create an in-memory session store (Map-backed, bounded). */
export function createInMemorySessionStore(options: InMemoryStoreOptions = {}): SessionStore {
  const maxEntries = options.maxEntries ?? 1000
  const map = new Map<string, ConversationState>()

  const touch = (id: string, state: ConversationState): void => {
    // Re-insert to move the key to the most-recently-used position.
    map.delete(id)
    map.set(id, state)
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value
      if (oldest === undefined) break
      map.delete(oldest)
    }
  }

  return Object.freeze({
    get: async (id) => {
      const value = map.get(id)
      if (value !== undefined) touch(id, value) // reading refreshes recency (true LRU)
      return value
    },
    set: async (id, state) => void touch(id, state),
    has: async (id) => map.has(id),
    delete: async (id) => void map.delete(id),
    size: async () => map.size,
  })
}
