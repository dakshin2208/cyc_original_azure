/**
 * @module lib/ai/chat/chat-service
 *
 * The Chat Service — the conversation manager that ties the pipeline together:
 * validate request → load/seed conversation state → AI Orchestrator (Sprint 4) →
 * LLM Adapter (Sprint 5) → persist state → map to an HTTP outcome. All
 * collaborators are injected (pure DI). It never throws and never leaks internals.
 * No framework types, no AI here — the engines decide, the adapter guards.
 */

import { sessionId } from '@/lib/ai/shared'
import {
  createConversationState,
  type AIOrchestrator,
  type ConversationState,
} from '@/lib/ai/orchestration'
import type { LLMAdapter, LLMResult } from '@/lib/ai/llm'
import type { ChatErrorBody, ChatOutcome, ChatResponse } from './dto'
import {
  HTTP_STATUS,
  SAFE_MESSAGE,
  TimeoutError,
  errorCodeForLLMStatus,
  type ChatErrorCode,
} from './errors'
import type { ChatLogger } from './logger'
import type { SessionStore } from './session-store'

/** Injected dependencies for the chat service. */
export interface ChatServiceDeps {
  readonly orchestrator: AIOrchestrator
  readonly adapter: LLMAdapter
  readonly sessionStore: SessionStore
  readonly logger: ChatLogger
  /** Millisecond clock (injected for deterministic tests). */
  readonly clock: () => number
  /** Conversation-id generator (injected for deterministic tests). */
  readonly idGenerator: () => string
  /** Per-request provider timeout budget. */
  readonly timeoutMs: number
  /** Maximum accepted message length (default 2000). */
  readonly maxMessageLength?: number
}

/** The framework-agnostic chat service. */
export interface ChatService {
  /** Handle one raw (already JSON-parsed) request body. Never throws. */
  handle(payload: unknown): Promise<ChatOutcome>
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reject a promise after `ms` with a {@link TimeoutError} (0 disables). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!ms || ms <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Create the chat service from its injected dependencies. */
export function createChatService(deps: ChatServiceDeps): ChatService {
  const maxLen = deps.maxMessageLength ?? 2000

  const errorOutcome = (
    code: ChatErrorCode,
    conversationId: string | null,
    extra?: Pick<ChatErrorBody, 'answer' | 'followUps'>,
  ): ChatOutcome => ({
    httpStatus: HTTP_STATUS[code],
    body: { error: SAFE_MESSAGE[code], code, conversationId, ...extra },
  })

  const handle = async (payload: unknown): Promise<ChatOutcome> => {
    // ── 1. Validate the request ───────────────────────────────────────────────
    if (!isRecord(payload) || typeof payload.message !== 'string') {
      deps.logger.log({ event: 'error', code: 'invalid_request', httpStatus: 400 })
      return errorOutcome('invalid_request', null)
    }
    const message = payload.message.trim()
    const conversationId =
      typeof payload.conversationId === 'string' && payload.conversationId.trim().length > 0
        ? payload.conversationId.trim()
        : null

    if (message.length === 0) return errorOutcome('empty_message', conversationId)
    if (message.length > maxLen) return errorOutcome('message_too_long', conversationId)

    // ── 2. Resolve / seed conversation state ─────────────────────────────────
    const id = conversationId ?? deps.idGenerator()
    const stored = conversationId ? await deps.sessionStore.get(conversationId) : undefined
    const priorState: ConversationState = stored ?? createConversationState(sessionId(id))
    deps.logger.log({ event: 'request', conversationId: id, messageLength: message.length })

    // ── 3. Orchestrate (Sprint 4) — deterministic, never throws ──────────────
    const orchestration = deps.orchestrator.orchestrate(message, priorState)
    deps.logger.log({
      event: 'orchestrated',
      conversationId: id,
      intent: orchestration.parsed.intent,
      evidenceCount: orchestration.context.evidence.count,
    })

    // ── 4. Generate + validate + guard (Sprint 5) with a timeout ─────────────
    const startedAt = deps.clock()
    let result: LLMResult
    try {
      result = await withTimeout(
        deps.adapter.respond(orchestration.prompt, orchestration.context),
        deps.timeoutMs,
      )
    } catch (e) {
      // The only expected rejection is a timeout; anything else is internal.
      const code: ChatErrorCode = e instanceof TimeoutError ? 'timeout' : 'internal_error'
      await deps.sessionStore.set(id, orchestration.state)
      deps.logger.log({
        event: 'error',
        conversationId: id,
        code,
        latencyMs: deps.clock() - startedAt,
        httpStatus: HTTP_STATUS[code],
      })
      return errorOutcome(code, id)
    }
    const latencyMs = deps.clock() - startedAt

    // ── 5. Persist the advanced conversation state ───────────────────────────
    await deps.sessionStore.set(id, orchestration.state)

    const guardRemoved = result.issues.filter((i) => i.code === 'removed_unsupported_sentence').length
    deps.logger.log({
      event: 'llm',
      conversationId: id,
      provider: result.provider,
      llmStatus: result.status,
      attempts: result.attempts,
      issues: result.issues.length,
      guardRemoved,
      fallback: result.status !== 'ok' && result.status !== 'repaired',
      latencyMs,
    })

    // ── 6. Map to an HTTP outcome ────────────────────────────────────────────
    if (result.status === 'ok' || result.status === 'repaired') {
      const body: ChatResponse = {
        answer: result.response.answer,
        citations: result.response.citations,
        confidence: result.response.confidence,
        followUps: result.response.followUps,
        conversationId: id,
      }
      deps.logger.log({ event: 'response', conversationId: id, httpStatus: 200, llmStatus: result.status })
      return { httpStatus: 200, body }
    }

    // Upstream failure: proper status code, but carry the safe fallback answer.
    const code = errorCodeForLLMStatus(result.status)
    deps.logger.log({
      event: 'response',
      conversationId: id,
      httpStatus: HTTP_STATUS[code],
      llmStatus: result.status,
      code,
    })
    return errorOutcome(code, id, {
      answer: result.response.answer,
      followUps: result.response.followUps,
    })
  }

  return Object.freeze({ handle })
}
