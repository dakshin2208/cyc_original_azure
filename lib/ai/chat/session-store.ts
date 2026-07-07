/**
 * @module lib/ai/chat/session-store
 *
 * Durable store for the canonical per-conversation {@link ConversationState}. The
 * interface is ASYNC so it can be backed by any remote store with no change to the
 * chat service. Two implementations ship: a bounded in-memory Map (tests/local), and
 * a Supabase-backed store that persists the state across Container App replicas and
 * cold-starts — the same pattern already used for the student profile. No AI.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

/** The Supabase table backing the persistent session store. */
const SESSION_TABLE = 'chat_conversations'

/**
 * Create a Supabase-backed session store, so the canonical {@link ConversationState}
 * survives across container replicas and cold-starts (multi-turn continuity holds even
 * when Azure runs multiple replicas). It DEGRADES GRACEFULLY: any DB error falls back to
 * the in-memory store, so a missing table or a transient fault can never break the chat —
 * it just behaves like before until the table exists. Mirrors the profile store exactly;
 * uses the service-role client (bypasses RLS), like the rest of the backend.
 */
export function createSupabaseSessionStore(
  admin: SupabaseClient,
  fallback: SessionStore = createInMemorySessionStore(),
): SessionStore {
  return Object.freeze({
    async get(id) {
      try {
        const { data, error } = await admin
          .from(SESSION_TABLE)
          .select('state')
          .eq('conversation_id', id)
          .limit(1)
        if (error) throw error
        if (data && data.length > 0) return data[0].state as ConversationState
        return fallback.get(id)
      } catch {
        return fallback.get(id) // never break the conversation on a DB fault
      }
    },
    async set(id, state) {
      await fallback.set(id, state) // keep the warm-process copy too
      try {
        const { error } = await admin
          .from(SESSION_TABLE)
          .upsert({ conversation_id: id, state, updated_at: new Date().toISOString() }, { onConflict: 'conversation_id' })
        if (error) throw error
      } catch {
        // best-effort persistence; the in-memory copy still serves same-process reads
      }
    },
    async has(id) {
      try {
        const { data, error } = await admin
          .from(SESSION_TABLE)
          .select('conversation_id')
          .eq('conversation_id', id)
          .limit(1)
        if (error) throw error
        if (data && data.length > 0) return true
        return fallback.has(id)
      } catch {
        return fallback.has(id)
      }
    },
    async delete(id) {
      await fallback.delete(id)
      try {
        await admin.from(SESSION_TABLE).delete().eq('conversation_id', id)
      } catch {
        // ignore
      }
    },
    size: async () => fallback.size(),
  })
}

/**
 * Build the persistent session store from environment (service-role Supabase), or
 * `null` when Supabase isn't configured (tests/local → the caller uses in-memory).
 * Mirrors {@link createConfiguredProfileStore}.
 */
export function createConfiguredSessionStore(env: Record<string, string | undefined>): SessionStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return createSupabaseSessionStore(admin)
}
