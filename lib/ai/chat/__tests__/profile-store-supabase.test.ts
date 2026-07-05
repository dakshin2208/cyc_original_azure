/**
 * @module lib/ai/chat/__tests__/profile-store-supabase.test
 *
 * The Supabase-backed profile store — the fix for the onboarding "restart loop".
 * Runs the REAL store against a schema-accurate in-memory fake of `chat_profiles`,
 * and proves the key property: a profile written by ONE store instance (one replica)
 * is read back by a SEPARATE instance (another replica) sharing the same table — so
 * the conversation is never forgotten between messages. Also verifies graceful
 * degradation to in-memory on a DB fault.
 */

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseProfileStore, createInMemoryProfileStore, emptyProfile } from '@/lib/ai/chat'
import type { StudentProfile } from '@/lib/ai/chat'

const COLUMNS = ['conversation_id', 'profile', 'created_at', 'updated_at']

/** A tiny schema-accurate fake of the chat_profiles table + its query builder. */
function makeFakeSupabase(opts: { failing?: boolean } = {}) {
  const rows: Array<Record<string, unknown>> = []
  const q = (table: string) => {
    if (table !== 'chat_profiles') throw new Error(`unexpected table ${table}`)
    const filters: Array<[string, unknown]> = []
    let op: 'select' | 'upsert' | 'delete' = 'select'
    let payload: Record<string, unknown> = {}
    const api: any = {
      select(cols: string) {
        op = 'select'
        cols.split(',').map((c) => c.trim()).forEach((c) => {
          if (!COLUMNS.includes(c)) throw new Error(`unknown column ${c}`)
        })
        return api
      },
      upsert(row: Record<string, unknown>) {
        op = 'upsert'
        Object.keys(row).forEach((k) => {
          if (!COLUMNS.includes(k)) throw new Error(`unknown column ${k}`)
        })
        payload = row
        return api
      },
      delete() {
        op = 'delete'
        return api
      },
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return api
      },
      limit() {
        return api
      },
      then(resolve: (r: { data: unknown; error: unknown }) => void) {
        if (opts.failing) return Promise.resolve({ data: null, error: { message: 'relation does not exist' } }).then(resolve)
        if (op === 'upsert') {
          const idx = rows.findIndex((r) => r.conversation_id === payload.conversation_id)
          if (idx >= 0) rows[idx] = { ...rows[idx], ...payload }
          else rows.push({ created_at: 'now', ...payload })
          return Promise.resolve({ data: null, error: null }).then(resolve)
        }
        if (op === 'delete') {
          for (let i = rows.length - 1; i >= 0; i--) if (filters.every(([k, v]) => rows[i][k] === v)) rows.splice(i, 1)
          return Promise.resolve({ data: null, error: null }).then(resolve)
        }
        const out = rows.filter((r) => filters.every(([k, v]) => r[k] === v))
        return Promise.resolve({ data: out, error: null }).then(resolve)
      },
    }
    return api
  }
  return { client: { from: q } as unknown as SupabaseClient, rows }
}

const withCutoff = (n: number): StudentProfile => ({ ...emptyProfile(), cutoff: n, answered: { cutoff: true, community: false, district: false, branch: false } })

describe('Supabase profile store — persistence across replicas', () => {
  it('a profile written by one instance is read back by a SEPARATE instance (the loop fix)', async () => {
    const db = makeFakeSupabase()
    const replicaA = createSupabaseProfileStore(db.client) // each with its OWN in-memory fallback
    const replicaB = createSupabaseProfileStore(db.client)

    // Replica A handles "180" → stores {cutoff:180}
    await replicaA.set('conv-1', withCutoff(180))
    // Replica B handles the NEXT message → must still see cutoff 180 (no restart)
    const seen = await replicaB.get('conv-1')
    expect(seen?.cutoff).toBe(180)
    expect(db.rows).toHaveLength(1)
  })

  it('round-trips a full profile and updates it', async () => {
    const db = makeFakeSupabase()
    const store = createSupabaseProfileStore(db.client)
    await store.set('c', withCutoff(190))
    expect((await store.get('c'))?.cutoff).toBe(190)
    await store.set('c', withCutoff(200)) // upsert — one row
    expect((await store.get('c'))?.cutoff).toBe(200)
    expect(db.rows).toHaveLength(1)
    await store.delete('c')
    expect(db.rows).toHaveLength(0)
  })

  it('degrades gracefully to in-memory on a DB fault (never breaks the chat)', async () => {
    const db = makeFakeSupabase({ failing: true })
    const fallback = createInMemoryProfileStore()
    const store = createSupabaseProfileStore(db.client, fallback)
    // set/get must not throw even though every DB call errors
    await store.set('c', withCutoff(175))
    const seen = await store.get('c') // served from the in-memory fallback
    expect(seen?.cutoff).toBe(175)
  })
})
