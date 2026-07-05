/**
 * @module lib/ai/chat/profile/profile-store
 *
 * Persists a {@link StudentProfile} per conversation. ASYNC (like the session
 * store) so it can later be backed by Redis with no service change. In-memory,
 * bounded, request/session-scoped — no database. Separate from the conversation-
 * state store so that store (and its tests) are untouched.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { StudentProfile } from './student-profile'

/** A replaceable per-conversation profile store (in-memory, or DB-backed for scale). */
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

/** The Supabase table backing the persistent profile store. */
const PROFILE_TABLE = 'chat_profiles'

/**
 * Create a Supabase-backed profile store, so the collected profile survives across
 * container replicas and cold-starts (the onboarding never restarts mid-conversation).
 * It DEGRADES GRACEFULLY: any DB error falls back to the in-memory store, so a missing
 * table or a transient fault can never break the chat — it just behaves like before
 * until the table exists. Uses the service-role client (bypasses RLS), like the rest
 * of the backend.
 */
export function createSupabaseProfileStore(
  admin: SupabaseClient,
  fallback: ProfileStore = createInMemoryProfileStore(),
): ProfileStore {
  return Object.freeze({
    async get(id) {
      try {
        const { data, error } = await admin
          .from(PROFILE_TABLE)
          .select('profile')
          .eq('conversation_id', id)
          .limit(1)
        if (error) throw error
        if (data && data.length > 0) return data[0].profile as StudentProfile
        return fallback.get(id)
      } catch {
        return fallback.get(id) // never break the conversation on a DB fault
      }
    },
    async set(id, profile) {
      await fallback.set(id, profile) // keep the warm-process copy too
      try {
        const { error } = await admin
          .from(PROFILE_TABLE)
          .upsert({ conversation_id: id, profile, updated_at: new Date().toISOString() }, { onConflict: 'conversation_id' })
        if (error) throw error
      } catch {
        // best-effort persistence; the in-memory copy still serves same-process reads
      }
    },
    async delete(id) {
      await fallback.delete(id)
      try {
        await admin.from(PROFILE_TABLE).delete().eq('conversation_id', id)
      } catch {
        // ignore
      }
    },
    size: async () => fallback.size(),
  })
}

/**
 * Build the persistent profile store from environment (service-role Supabase), or
 * `null` when Supabase isn't configured (tests/local → the caller uses in-memory).
 */
export function createConfiguredProfileStore(env: Record<string, string | undefined>): ProfileStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return createSupabaseProfileStore(admin)
}
