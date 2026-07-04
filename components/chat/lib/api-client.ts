/**
 * @module components/chat/lib/api-client
 *
 * A typed client for `POST /api/chat`. It is TRANSPORT ONLY — it serializes the
 * request, applies a timeout, retries transient failures, supports cancellation,
 * and normalizes every outcome into a {@link SendResult}. It contains NO business
 * logic, calls NO provider, and never bypasses the backend route. `fetch` is
 * injectable for deterministic tests.
 */

import { errorForException, errorForStatus } from './errors'
import type { ChatApiError, ChatResponse } from './types'

/** Client configuration (all optional; production-safe defaults). */
export interface ChatClientConfig {
  readonly endpoint?: string
  readonly timeoutMs?: number
  /** Additional attempts after the first, for retryable failures (default 1). */
  readonly retries?: number
  readonly retryDelayMs?: number
  readonly fetchImpl?: typeof fetch
  /** Sleep function (injectable for tests). */
  readonly sleep?: (ms: number) => Promise<void>
}

/** The request payload. */
export interface SendInput {
  readonly message: string
  readonly conversationId?: string | null
}

/** Per-call options. */
export interface SendOptions {
  /** External signal to cancel the (whole) request, including retries. */
  readonly signal?: AbortSignal
}

/** The normalized result of a send. */
export interface SendResult {
  readonly ok: boolean
  /** HTTP status, or 0 for a network/timeout/cancel outcome. */
  readonly status: number
  readonly data?: ChatResponse
  readonly error?: ChatApiError
  /** Number of attempts made (1 = no retry). */
  readonly attempts: number
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Create a chat API client. */
export function createChatClient(config: ChatClientConfig = {}) {
  const endpoint = config.endpoint ?? '/api/chat'
  const timeoutMs = config.timeoutMs ?? 30_000
  const retries = Math.max(0, config.retries ?? 1)
  const retryDelayMs = config.retryDelayMs ?? 400
  const doFetch = config.fetchImpl ?? fetch
  const sleep = config.sleep ?? defaultSleep

  async function attempt(input: SendInput, external?: AbortSignal): Promise<SendResult> {
    const controller = new AbortController()
    let timedOut = false
    const onExternalAbort = (): void => controller.abort()

    if (external) {
      if (external.aborted) return { ok: false, status: 0, error: errorForException(makeAbort()), attempts: 1 }
      external.addEventListener('abort', onExternalAbort, { once: true })
    }
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        }),
        signal: controller.signal,
      })

      if (response.ok) {
        const data = (await response.json()) as ChatResponse
        return { ok: true, status: response.status, data, attempts: 1 }
      }
      const body = (await response.json().catch(() => undefined)) as { code?: string } | undefined
      return { ok: false, status: response.status, error: errorForStatus(response.status, body), attempts: 1 }
    } catch (e) {
      // A user cancel aborts without `timedOut`; distinguish it from a timeout.
      const canceledByUser = external?.aborted === true && !timedOut
      const error = canceledByUser ? errorForException(makeAbort()) : errorForException(e, timedOut)
      return { ok: false, status: 0, error, attempts: 1 }
    } finally {
      clearTimeout(timer)
      if (external) external.removeEventListener('abort', onExternalAbort)
    }
  }

  async function send(input: SendInput, opts?: SendOptions): Promise<SendResult> {
    let last: SendResult = { ok: false, status: 0, error: errorForException(null), attempts: 0 }
    for (let i = 0; i <= retries; i++) {
      const result = await attempt(input, opts?.signal)
      last = { ...result, attempts: i + 1 }
      if (result.ok) return last
      // Do not retry non-retryable errors or a user cancellation.
      if (!result.error?.retryable || opts?.signal?.aborted) return last
      if (i < retries) await sleep(retryDelayMs)
    }
    return last
  }

  return Object.freeze({ send })
}

/** A synthetic AbortError (name-compatible) for the cancel path. */
function makeAbort(): Error {
  const e = new Error('canceled')
  e.name = 'AbortError'
  return e
}
