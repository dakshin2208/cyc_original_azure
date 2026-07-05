/**
 * @module lib/ai/shared/contracts/request-context
 *
 * The per-turn context threaded explicitly through every module. Modules are
 * stateless; the turn carries its own identity, auth, and correlation ids, so
 * concurrent turns stay isolated on a shared server instance (Project Structure,
 * doc 07 §9).
 */

import type { PlanType } from './domain'
import type { SessionId, TraceId, TurnId, UserId } from '../ids'

/** Authorization context for the current user, scoped to a single turn. */
export interface AuthContext {
  /** The authenticated user's id, or `null` for an anonymous session. */
  readonly userId: UserId | null
  /** Whether the request is authenticated. */
  readonly isAuthenticated: boolean
  /** The user's active plan (drives entitlement/feature gating). */
  readonly plan: PlanType
  /** Coarse role labels (e.g. `'admin'`), if any. */
  readonly roles: readonly string[]
}

/**
 * Immutable context for a single counseling turn. Constructed once at the
 * Gateway and passed to every downstream call.
 */
export interface RequestContext {
  /** The authenticated user's id, or `null` if anonymous. */
  readonly userId: UserId | null
  /** The conversation/session this turn belongs to. */
  readonly sessionId: SessionId
  /** This turn's unique id. */
  readonly turnId: TurnId
  /** Correlation id spanning all work for this turn. */
  readonly traceId: TraceId
  /** Authorization context. */
  readonly auth: AuthContext
  /** BCP-47 locale hint for response language/formatting, if provided. */
  readonly locale?: string
  /** ISO-8601 timestamp when the turn started. */
  readonly startedAt: string
}
