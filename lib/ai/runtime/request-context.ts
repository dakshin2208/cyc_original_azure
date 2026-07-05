/**
 * @module lib/ai/runtime/request-context
 *
 * Factory for the per-turn {@link RequestContext}. Ids are generated here and
 * time comes from the injected {@link ClockPort}, so context creation is
 * deterministic under test (inject a fixed clock and id generator) and free of
 * ambient globals in the core (Project Structure, doc 07 §9).
 */

import { randomUUID } from 'crypto'
import {
  type AuthContext,
  type ClockPort,
  type RequestContext,
  type SessionId,
  traceId,
  turnId,
  type UserId,
} from '@/lib/ai/shared'

/** Inputs required to open a new turn's context. */
export interface RequestContextInput {
  /** The session this turn belongs to. */
  readonly sessionId: SessionId
  /** The authenticated user, or `null` when anonymous. */
  readonly userId?: UserId | null
  /** Authorization context for the turn. */
  readonly auth: AuthContext
  /** Optional BCP-47 locale hint. */
  readonly locale?: string
}

/** Generates opaque unique id strings (turn/trace ids). */
export type IdGenerator = () => string

/** Default id generator using the platform crypto UUID. */
export const defaultIdGenerator: IdGenerator = () => randomUUID()

/**
 * Build an immutable {@link RequestContext} for a single turn.
 *
 * @param input      Session, user, auth, and optional locale.
 * @param clock      Time source for `startedAt`.
 * @param generateId Id generator (defaults to crypto UUID); inject for tests.
 */
export function createRequestContext(
  input: RequestContextInput,
  clock: ClockPort,
  generateId: IdGenerator = defaultIdGenerator,
): RequestContext {
  return Object.freeze({
    userId: input.userId ?? null,
    sessionId: input.sessionId,
    turnId: turnId(generateId()),
    traceId: traceId(generateId()),
    auth: input.auth,
    ...(input.locale ? { locale: input.locale } : {}),
    startedAt: clock.isoNow(),
  })
}
