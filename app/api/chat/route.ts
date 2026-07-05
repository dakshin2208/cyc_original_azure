/**
 * POST /api/chat — the Chat API endpoint.
 *
 * A THIN adapter: it authenticates the user and enforces their per-plan AI-chat
 * question limit (production integration), then delegates ALL conversation logic to
 * the shared, dependency-injected chat service. It constructs no reasoning, holds no
 * conversation state, and never exposes internals. POST only (other methods auto-405).
 *
 * The auth + limit gate is the only thing added here — the counsellor's reasoning,
 * retrieval, recommendation, opinion, eligibility, and prompts are untouched.
 */

import { NextResponse } from 'next/server'
import { getChatService, getChatUsageGuard } from '@/lib/ai/chat'

/** Run on the Node.js runtime (the warehouse build uses Node fs). */
export const runtime = 'nodejs'
/** Never cache chat responses. */
export const dynamic = 'force-dynamic'

const json = (body: unknown, status: number): Response => NextResponse.json(body, { status })

export async function POST(request: Request): Promise<Response> {
  // Resolve the wired service + usage guard (both memoized). A misconfiguration → 500.
  let service
  let guard
  try {
    service = getChatService()
    guard = getChatUsageGuard()
  } catch {
    return json({ error: 'Chat service is not configured.', code: 'internal_error', conversationId: null }, 500)
  }

  // ── Auth + per-plan question limit (production integration) ──────────────────
  // Authenticate via the verified session token and check the remaining quota BEFORE
  // doing any work. Anonymous (no valid token) → 401, so limits can't be bypassed by
  // not logging in. Over the plan's aiChatLimit → 429.
  let gate
  try {
    gate = await guard.check(request)
  } catch {
    // Usage backend fault — fail closed (do not silently grant unlimited paid calls).
    return json({ error: 'Chat is temporarily unavailable. Please try again.', code: 'usage_unavailable', conversationId: null }, 503)
  }
  if (!gate.allow) {
    return json({ error: gate.message, code: gate.code, conversationId: null }, gate.status)
  }

  // Parse the body defensively.
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.', code: 'invalid_request', conversationId: null }, 400)
  }

  // Delegate to the (unchanged) service. It is designed not to throw, but a conformant
  // async session store may reject on a network fault — keep a coded-JSON safety net.
  let outcome
  try {
    outcome = await service.handle(payload)
  } catch {
    return json({ error: 'An unexpected error occurred.', code: 'internal_error', conversationId: null }, 500)
  }

  // Count ONE question against the quota only for a successful, SUBSTANTIVE answer —
  // profile-collection prompts (stage 'collecting') ask the student for details and are
  // not questions the student "spent". A metering failure must never fail the response.
  const stage = (outcome.body as { stage?: string } | null)?.stage
  if (outcome.httpStatus === 200 && stage !== 'collecting') {
    try {
      await guard.record(gate.userId, gate.email, gate.planType)
    } catch {
      // best-effort; the user already got their answer
    }
  }

  return json(outcome.body, outcome.httpStatus)
}
