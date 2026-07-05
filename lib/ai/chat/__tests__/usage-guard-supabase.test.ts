/**
 * @module lib/ai/chat/__tests__/usage-guard-supabase.test
 *
 * Verifies the REAL Supabase-backed store (`createSupabaseChatUsageStore`) against a
 * SCHEMA-ACCURATE in-memory fake of the `ai_chat_usage` migration — so every query,
 * insert, update, and read is exercised exactly as it will run in production, and any
 * column/constraint mismatch fails the test. Also drives the complete per-plan and
 * daily-reset flows end-to-end through the guard.
 */

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createChatUsageGuard, createSupabaseChatUsageStore, usageDay } from '@/lib/ai/chat'
import type { PlanType } from '@/lib/plans'

// ── The exact columns the migration creates (unknown-column access → error) ───
const SCHEMA: Record<string, string[]> = {
  ai_chat_usage: ['id', 'user_id', 'email', 'usage_date', 'questions_used', 'plan_type', 'created_at', 'updated_at'],
  choice_filling_usage: ['id', 'user_id', 'email', 'usage_count', 'max_choices', 'plan_type', 'created_at', 'updated_at'],
  user_referrals: ['id', 'referrer_id', 'referrer_email', 'referred_email', 'status', 'created_at'],
}
// Unique constraints enforced on insert (mirrors the migration's unique indexes).
const UNIQUE: Record<string, string[]> = { ai_chat_usage: ['user_id', 'usage_date'] }

interface Row {
  [k: string]: unknown
}

/** A tiny schema-validating, awaitable query builder over an in-memory table. */
class FakeQuery {
  private op: 'select' | 'insert' | 'update' = 'select'
  private cols: string[] = []
  private filters: Array<[string, unknown]> = []
  private orderBy?: { col: string; ascending: boolean }
  private lim?: number
  private payload: Row = {}
  private seq: () => number

  constructor(private table: string, private rows: Row[], seq: () => number) {
    this.seq = seq
  }

  private known(col: string): void {
    const schema = SCHEMA[this.table]
    if (!schema) throw new Error(`unknown table "${this.table}"`)
    // "id, questions_used" style select lists
    for (const c of col.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!schema.includes(c)) throw new Error(`column "${c}" does not exist on ${this.table}`)
    }
  }

  select(cols: string): this {
    this.op = 'select'
    this.known(cols)
    this.cols = cols.split(',').map((s) => s.trim())
    return this
  }
  insert(row: Row): this {
    this.op = 'insert'
    Object.keys(row).forEach((k) => this.known(k))
    this.payload = row
    return this
  }
  update(patch: Row): this {
    this.op = 'update'
    Object.keys(patch).forEach((k) => this.known(k))
    this.payload = patch
    return this
  }
  eq(col: string, val: unknown): this {
    this.known(col)
    this.filters.push([col, val])
    return this
  }
  order(col: string, opts: { ascending: boolean }): this {
    this.known(col)
    this.orderBy = { col, ascending: opts.ascending }
    return this
  }
  limit(n: number): this {
    this.lim = n
    return this
  }

  private match(r: Row): boolean {
    return this.filters.every(([k, v]) => r[k] === v)
  }

  private run(): { data: Row[] | null; error: { message: string } | null } {
    try {
      if (this.op === 'insert') {
        const uniq = UNIQUE[this.table]
        if (uniq && this.rows.some((r) => uniq.every((k) => r[k] === this.payload[k]))) {
          return { data: null, error: { message: `duplicate key value violates unique constraint on (${uniq.join(',')})` } }
        }
        const row: Row = {
          id: `row-${this.seq()}`,
          questions_used: 0,
          plan_type: 'freemium',
          created_at: new Date(2000, 0, 1, this.seq()).toISOString(),
          updated_at: new Date(2000, 0, 1, this.seq()).toISOString(),
          email: null,
          ...this.payload,
        }
        this.rows.push(row)
        return { data: [row], error: null }
      }
      if (this.op === 'update') {
        this.rows.filter((r) => this.match(r)).forEach((r) => Object.assign(r, this.payload))
        return { data: null, error: null }
      }
      // select
      let out = this.rows.filter((r) => this.match(r))
      if (this.orderBy) {
        const { col, ascending } = this.orderBy
        out = [...out].sort((a, b) => (a[col]! < b[col]! ? -1 : a[col]! > b[col]! ? 1 : 0) * (ascending ? 1 : -1))
      }
      if (this.lim != null) out = out.slice(0, this.lim)
      return { data: out.map((r) => Object.fromEntries(this.cols.map((c) => [c, r[c]]))), error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }

  then<T>(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => T): Promise<T> {
    return Promise.resolve(this.run()).then(resolve)
  }
}

function makeFakeSupabase(users: Record<string, { id: string; email: string | null }>, seed: { choicePlan?: Record<string, PlanType> } = {}) {
  const tables: Record<string, Row[]> = { ai_chat_usage: [], choice_filling_usage: [], user_referrals: [] }
  // seed plan rows so resolvePlan finds them
  for (const [uid, plan] of Object.entries(seed.choicePlan ?? {})) {
    tables.choice_filling_usage.push({ id: `cf-${uid}`, user_id: uid, email: null, plan_type: plan, created_at: '2020-01-01T00:00:00Z' })
  }
  let n = 0
  const client = {
    auth: {
      getUser: async (token: string) => {
        const u = users[token]
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'invalid token' } }
      },
    },
    from: (table: string) => new FakeQuery(table, tables[table] ?? (tables[table] = []), () => ++n),
  } as unknown as SupabaseClient
  return { client, tables }
}

const req = (auth?: string): Request =>
  new Request('http://localhost/api/chat', { method: 'POST', headers: auth ? { authorization: auth } : {} })

describe('Supabase store — schema-accurate queries (every read/insert/update)', () => {
  it('reads 0 for a new user, then increment creates today\'s row, then reads it back', async () => {
    const { client, tables } = makeFakeSupabase({ tok: { id: 'u1', email: 'a@b.com' } })
    const store = createSupabaseChatUsageStore(client)
    expect(await store.readUsed('u1', 'a@b.com', 'freemium')).toBe(0)
    await store.increment('u1', 'a@b.com', 'freemium')
    expect(await store.readUsed('u1', 'a@b.com', 'freemium')).toBe(1)
    // exactly one row, for today, questions_used = 1
    expect(tables.ai_chat_usage).toHaveLength(1)
    expect(tables.ai_chat_usage[0].usage_date).toBe(usageDay(new Date()))
    expect(tables.ai_chat_usage[0].questions_used).toBe(1)
  })

  it('resolves the plan from choice_filling_usage', async () => {
    const { client } = makeFakeSupabase({ tok: { id: 'u2', email: null } }, { choicePlan: { u2: 'premium_299' } })
    const store = createSupabaseChatUsageStore(client)
    expect(await store.resolvePlan('u2')).toBe('premium_299')
  })

  it('verifyUser: valid token → user, missing/invalid → null', async () => {
    const { client } = makeFakeSupabase({ good: { id: 'u3', email: 'x@y.com' } })
    const store = createSupabaseChatUsageStore(client)
    expect(await store.verifyUser('good')).toEqual({ id: 'u3', email: 'x@y.com' })
    expect(await store.verifyUser('bad')).toBeNull()
    expect(await store.verifyUser(null)).toBeNull()
  })
})

describe('End-to-end guard over the real store + schema fake — per-plan limits', () => {
  const cases: Array<{ plan: PlanType; label: string; limit: number }> = [
    { plan: 'freemium', label: 'Free', limit: 2 },
    { plan: 'premium_199', label: 'Secure', limit: 5 },
    { plan: 'premium_299', label: 'Assured', limit: 8 },
    { plan: 'premium_499', label: 'Assured+', limit: 20 },
  ]

  for (const c of cases) {
    it(`${c.label}: first ${c.limit} questions succeed, #${c.limit + 1} is blocked`, async () => {
      const { client } = makeFakeSupabase({ t: { id: 'u', email: 'u@e.com' } }, { choicePlan: { u: c.plan } })
      const guard = createChatUsageGuard(createSupabaseChatUsageStore(client))

      for (let i = 1; i <= c.limit; i++) {
        const gate = await guard.check(req('Bearer t'))
        expect(gate.allow, `question #${i} should be allowed`).toBe(true)
        if (gate.allow) await guard.record(gate.userId, gate.email, gate.planType) // simulate a successful answer
      }
      const blocked = await guard.check(req('Bearer t'))
      expect(blocked.allow, `question #${c.limit + 1} should be blocked`).toBe(false)
      if (!blocked.allow) {
        expect(blocked.status).toBe(429)
        expect(blocked.code).toBe('limit_reached')
      }
    })
  }

  it('anonymous (no token) → 401, never reaches the store counters', async () => {
    const { client, tables } = makeFakeSupabase({ t: { id: 'u', email: null } })
    const guard = createChatUsageGuard(createSupabaseChatUsageStore(client))
    const gate = await guard.check(req()) // no Authorization header
    expect(gate.allow).toBe(false)
    if (!gate.allow) expect(gate.status).toBe(401)
    expect(tables.ai_chat_usage).toHaveLength(0) // nothing written for an anonymous request
  })
})

describe('Daily reset — the allowance renews at the IST day boundary', () => {
  it('Free user blocked after 2 today is allowed again the next day', async () => {
    const { client, tables } = makeFakeSupabase({ t: { id: 'u', email: 'u@e.com' } }, { choicePlan: { u: 'freemium' } })
    let clock = new Date('2026-07-05T06:00:00Z') // day 1
    const guard = createChatUsageGuard(createSupabaseChatUsageStore(client, () => clock))

    // consume the 2 daily questions
    for (let i = 0; i < 2; i++) {
      const g = await guard.check(req('Bearer t'))
      expect(g.allow).toBe(true)
      if (g.allow) await guard.record(g.userId, g.email, g.planType)
    }
    expect((await guard.check(req('Bearer t'))).allow).toBe(false) // 3rd blocked today

    // advance to the next IST day → fresh allowance
    clock = new Date('2026-07-06T06:00:00Z')
    const nextDay = await guard.check(req('Bearer t'))
    expect(nextDay.allow).toBe(true)
    if (nextDay.allow) await guard.record(nextDay.userId, nextDay.email, nextDay.planType)

    // a separate row per day (unique on user_id+usage_date)
    expect(tables.ai_chat_usage).toHaveLength(2)
    expect(new Set(tables.ai_chat_usage.map((r) => r.usage_date)).size).toBe(2)
  })
})
