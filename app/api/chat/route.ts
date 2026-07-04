/**
 * POST /api/chat — the Chat API endpoint (Sprint 6).
 *
 * A THIN adapter: it resolves the shared, dependency-injected chat service from
 * the composition root, parses the JSON body, delegates all logic to the service,
 * and serializes the outcome. It constructs no dependencies, holds no state, and
 * never exposes internals. POST only (other methods auto-405 in the App Router).
 */

import { NextResponse } from 'next/server'
import { getChatService } from '@/lib/ai/chat'

/** Run on the Node.js runtime (the warehouse build uses Node fs). */
export const runtime = 'nodejs'
/** Never cache chat responses. */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  // Resolve the wired service (memoized). A misconfiguration surfaces as 500.
  let service
  try {
    service = getChatService()
  } catch {
    return NextResponse.json(
      { error: 'Chat service is not configured.', code: 'internal_error', conversationId: null },
      { status: 500 },
    )
  }

  // Parse the body defensively.
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', code: 'invalid_request', conversationId: null },
      { status: 400 },
    )
  }

  // Delegate to the service. It is designed not to throw, but a conformant async
  // session store (e.g. a future Redis store) may reject on a network fault — so
  // we keep a final safety net that preserves the coded-JSON HTTP contract and
  // never leaks internals, rather than letting the framework emit a generic 500.
  try {
    const outcome = await service.handle(payload)
    return NextResponse.json(outcome.body, { status: outcome.httpStatus })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred.', code: 'internal_error', conversationId: null },
      { status: 500 },
    )
  }
}
