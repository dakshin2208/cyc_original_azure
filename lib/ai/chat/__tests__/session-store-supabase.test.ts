/**
 * @module lib/ai/chat/__tests__/session-store-supabase.test
 *
 * The Supabase-backed session store — durable ConversationState (Phase 3). Runs the
 * REAL store against a schema-accurate in-memory fake of `chat_conversations`, and
 * proves the key property mirrored from the profile store: state written by ONE store
 * instance (one replica) is read back by a SEPARATE instance (another replica) sharing
 * the same table — so multi-turn continuity survives across replicas. Also verifies
 * graceful degradation to in-memory on a DB fault (never breaks the chat).
 */

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseSessionStore, createInMemorySessionStore } from '@/lib/ai/chat'
import type { ConversationState } from '@/lib/ai/orchestration'

const COLUMNS = ['conversation_id', 'state', 'created_at', 'updated_at']

/** A tiny schema-accurate fake of the chat_conversations table + its query builder. */
function makeFakeSupabase(opts: { failing?: boolean } = {}) {
  const rows: Array<Record<string, unknown>> = []
  const q = (table: string) => {
    if (table !== 'chat_conversations') throw new Error(`unexpected table ${table}`)
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

const stateWithTurns = (n: number): ConversationState => ({ turnCount: n } as unknown as ConversationState)

describe('Supabase session store — durable ConversationState across replicas', () => {
  it('state written by one instance is read back by a SEPARATE instance', async () => {
    const db = makeFakeSupabase()
    const replicaA = createSupabaseSessionStore(db.client) // each with its OWN in-memory fallback
    const replicaB = createSupabaseSessionStore(db.client)

    await replicaA.set('conv-1', stateWithTurns(2))
    const seen = await replicaB.get('conv-1') // another replica must still see turnCount 2
    expect((seen as { turnCount?: number } | undefined)?.turnCount).toBe(2)
    expect(db.rows).toHaveLength(1)
  })

  it('round-trips and upserts state, and deletes', async () => {
    const db = makeFakeSupabase()
    const store = createSupabaseSessionStore(db.client)
    await store.set('c', stateWithTurns(1))
    expect((await store.get('c') as { turnCount?: number } | undefined)?.turnCount).toBe(1)
    await store.set('c', stateWithTurns(3)) // upsert — one row
    expect((await store.get('c') as { turnCount?: number } | undefined)?.turnCount).toBe(3)
    expect(await store.has('c')).toBe(true)
    expect(db.rows).toHaveLength(1)
    await store.delete('c')
    expect(db.rows).toHaveLength(0)
  })

  it('degrades gracefully to in-memory on a DB fault (never breaks the chat)', async () => {
    const db = makeFakeSupabase({ failing: true })
    const fallback = createInMemorySessionStore()
    const store = createSupabaseSessionStore(db.client, fallback)
    // set/get/has must not throw even though every DB call errors
    await store.set('c', stateWithTurns(5))
    const seen = await store.get('c') // served from the in-memory fallback
    expect((seen as { turnCount?: number } | undefined)?.turnCount).toBe(5)
    expect(await store.has('c')).toBe(true)
  })
})
