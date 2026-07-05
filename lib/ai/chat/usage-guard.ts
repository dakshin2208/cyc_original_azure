/**
 * @module lib/ai/chat/usage-guard
 *
 * Production integration for the AI-chat endpoint: **authentication + per-plan
 * question-limit enforcement**. It is NOT part of the counsellor's reasoning — it
 * wraps the (unchanged) chat service at the HTTP boundary, exactly mirroring the
 * choice-filling usage system:
 *
 *   • identify the user (verified Supabase session token — never a client-supplied id),
 *   • resolve their plan the same way `check-usage` does (choice_filling_usage.plan_type
 *     + referral upgrades),
 *   • read/increment a per-user counter in an `ai_chat_usage` table (a mirror of
 *     `choice_filling_usage`), using the service-role client,
 *   • enforce the limit from {@link getPlanLimits}.aiChatLimit — the SAME constants that
 *     drive the pricing page (no duplication).
 *
 * Anonymous requests (no valid token) are rejected, so limits cannot be bypassed by
 * simply not logging in. The Supabase-touching pieces are isolated behind a small,
 * injectable interface so the decision logic is unit-tested without a database.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPlanLimits, referralPlanFor, type PlanType } from '@/lib/plans'

/** Result of the pre-flight auth + quota check. */
export type GuardOutcome =
  | { readonly allow: true; readonly userId: string; readonly email: string | null; readonly planType: PlanType }
  | {
      readonly allow: false
      readonly status: 401 | 429 | 503
      readonly code: 'unauthenticated' | 'limit_reached' | 'usage_unavailable'
      readonly message: string
    }

/** The auth + usage gate the route consults before/after calling the chat service. */
export interface ChatUsageGuard {
  /** Authenticate the request and check the remaining quota. */
  check(request: Request): Promise<GuardOutcome>
  /** Record ONE consumed question against the user's quota (after a successful answer). */
  record(userId: string, email: string | null, planType: PlanType): Promise<void>
}

/** Thrown when the guard cannot be constructed (missing Supabase configuration). */
export class ChatUsageGuardConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatUsageGuardConfigError'
  }
}

/**
 * Pure quota decision: a user may ask another question iff they are below the limit.
 * Kept separate so the rule is unit-tested without any I/O.
 */
export function withinLimit(used: number, limit: number): boolean {
  return used < limit
}

/** Extract a Bearer token from the Authorization header (case-insensitive). */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

// ── Injectable data adapter (the only part that touches Supabase) ─────────────

/** The store operations the guard needs — a seam so the logic is testable. */
export interface ChatUsageStore {
  /** Verify a session token → the authenticated user, or null if invalid/absent. */
  verifyUser(token: string | null): Promise<{ id: string; email: string | null } | null>
  /** Resolve the user's effective plan (choice_filling_usage.plan_type + referral upgrades). */
  resolvePlan(userId: string): Promise<PlanType>
  /** Read the user's consumed AI-chat questions (0 if no row yet). */
  readUsed(userId: string, email: string | null, planType: PlanType): Promise<number>
  /** Increment the user's consumed AI-chat questions by one. */
  increment(userId: string, email: string | null, planType: PlanType): Promise<void>
}

/** Build a guard over any {@link ChatUsageStore} (production uses the Supabase one). */
export function createChatUsageGuard(store: ChatUsageStore): ChatUsageGuard {
  return Object.freeze({
    async check(request: Request): Promise<GuardOutcome> {
      const user = await store.verifyUser(bearerToken(request))
      if (!user) {
        return {
          allow: false,
          status: 401,
          code: 'unauthenticated',
          message: 'Please sign in to chat with the AI counsellor.',
        }
      }
      const planType = await store.resolvePlan(user.id)
      const limits = getPlanLimits(planType)
      const used = await store.readUsed(user.id, user.email, planType)
      if (!withinLimit(used, limits.aiChatLimit)) {
        return {
          allow: false,
          status: 429,
          code: 'limit_reached',
          message: `You've used all ${limits.aiChatLimit} AI counsellor questions on the ${limits.name} plan. Upgrade your plan for more.`,
        }
      }
      return { allow: true, userId: user.id, email: user.email, planType }
    },
    record(userId, email, planType) {
      return store.increment(userId, email, planType)
    },
  })
}

// ── Production Supabase store (mirrors app/api/check-usage + track-usage) ──────

/** The `ai_chat_usage` table — a mirror of `choice_filling_usage` for chat questions. */
const USAGE_TABLE = 'ai_chat_usage'

/** Create the Supabase-backed store using the service-role key (like choice-filling). */
export function createSupabaseChatUsageStore(admin: SupabaseClient): ChatUsageStore {
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
    return Number.isFinite(n) ? n : 0
  }
  return {
    async verifyUser(token) {
      if (!token) return null
      // getUser(token) validates the JWT against the auth server — a client cannot forge it.
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data?.user) return null
      return { id: data.user.id, email: data.user.email ?? null }
    },
    async resolvePlan(userId) {
      // Same resolution as /api/check-usage: stored plan_type, upgraded by completed referrals.
      const { data: rows } = await admin
        .from('choice_filling_usage')
        .select('plan_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
      let planType = ((rows?.[0]?.plan_type as PlanType) ?? 'freemium') as PlanType
      if (!String(planType).startsWith('premium')) {
        const { data: refs } = await admin
          .from('user_referrals')
          .select('id')
          .eq('referrer_id', userId)
          .eq('status', 'completed')
        const earned = referralPlanFor(refs?.length ?? 0)
        if (earned) planType = earned.planType
      }
      return planType
    },
    async readUsed(userId, email, planType) {
      const { data, error } = await admin
        .from(USAGE_TABLE)
        .select('questions_used')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
      // A real DB error (e.g. the table is missing) must FAIL CLOSED — never silently
      // return 0, which would disable enforcement and grant unlimited paid calls.
      if (error) throw new Error(`ai_chat_usage read failed: ${error.message}`)
      if (data && data.length > 0) return num(data[0].questions_used)
      // No row yet → lazily create it on first use (exactly like check-usage does).
      const { error: insertError } = await admin
        .from(USAGE_TABLE)
        .insert({ user_id: userId, email, questions_used: 0, plan_type: planType })
      if (insertError) throw new Error(`ai_chat_usage insert failed: ${insertError.message}`)
      return 0
    },
    async increment(userId, email, planType) {
      const { data, error } = await admin
        .from(USAGE_TABLE)
        .select('id, questions_used')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
      if (error) throw new Error(`ai_chat_usage read failed: ${error.message}`)
      if (data && data.length > 0) {
        const { error: updateError } = await admin
          .from(USAGE_TABLE)
          .update({ questions_used: num(data[0].questions_used) + 1, plan_type: planType, updated_at: new Date().toISOString() })
          .eq('id', data[0].id)
        if (updateError) throw new Error(`ai_chat_usage update failed: ${updateError.message}`)
      } else {
        const { error: insertError } = await admin
          .from(USAGE_TABLE)
          .insert({ user_id: userId, email, questions_used: 1, plan_type: planType })
        if (insertError) throw new Error(`ai_chat_usage insert failed: ${insertError.message}`)
      }
    },
  }
}

/** Construct the production guard from environment (throws if unconfigured). */
export function createSupabaseChatUsageGuard(): ChatUsageGuard {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new ChatUsageGuardConfigError(
      'AI-chat usage guard requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return createChatUsageGuard(createSupabaseChatUsageStore(admin))
}

// ── Memoized resolver + test seam (mirrors the chat-service container) ─────────

let cached: ChatUsageGuard | null = null
let override: ChatUsageGuard | null = null

/** Resolve the shared guard (memoized). Honours a test override. */
export function getChatUsageGuard(): ChatUsageGuard {
  if (override) return override
  if (!cached) cached = createSupabaseChatUsageGuard()
  return cached
}

/** Inject a guard (tests). */
export function setChatUsageGuardOverride(guard: ChatUsageGuard): void {
  override = guard
}

/** Clear the memoized + overridden guard (tests). */
export function resetChatUsageGuard(): void {
  cached = null
  override = null
}
