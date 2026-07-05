'use client'

/**
 * @module components/chat/use-chat
 *
 * The single React hook that owns conversation state. It wires the pure reducer
 * to the typed API client, manages the in-flight request (cancel/retry), and
 * exposes a small imperative API to the UI. All state lives in the reducer — no
 * component duplicates it. It NEVER talks to a provider; it only calls
 * `POST /api/chat` through the client.
 */

import { useCallback, useMemo, useReducer, useRef } from 'react'
import { createChatClient, type ChatClientConfig } from './lib/api-client'
import {
  conversationReducer,
  initialConversationState,
  type ConversationState,
} from './lib/conversation-reducer'
import { USER_MESSAGE } from './lib/errors'
import type { ChatApiError, ChatMessage, ChatResponse } from './lib/types'

/** A client-shaped dependency (injectable for tests/storybook). */
export interface ChatClientLike {
  send(
    input: { message: string; conversationId?: string | null },
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: boolean; status: number; data?: ChatResponse; error?: ChatApiError }>
}

/** Options for {@link useChat}. */
export interface UseChatOptions {
  readonly client?: ChatClientLike
  readonly config?: ChatClientConfig
}

/** The public surface of the chat hook. */
export interface UseChat {
  readonly messages: readonly ChatMessage[]
  readonly conversationId: string | null
  readonly isSending: boolean
  readonly lastError: ChatApiError | null
  send(text: string): void
  retry(): void
  cancel(): void
  clear(): void
  reset(): void
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

/** Own and drive the conversation. */
export function useChat(options: UseChatOptions = {}): UseChat {
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState)
  const client = useMemo<ChatClientLike>(
    () => options.client ?? createChatClient(options.config),
    // Construct once; option changes after mount are intentionally ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const controllerRef = useRef<AbortController | null>(null)
  const stateRef = useRef<ConversationState>(state)
  stateRef.current = state

  const run = useCallback(
    async (text: string, pendingId: string): Promise<void> => {
      const controller = new AbortController()
      controllerRef.current = controller
      const result = await client.send(
        { message: text, conversationId: stateRef.current.conversationId },
        { signal: controller.signal },
      )
      controllerRef.current = null
      if (result.ok && result.data) {
        dispatch({ type: 'received', pendingId, response: result.data, at: Date.now() })
      } else if (result.error?.kind === 'canceled') {
        dispatch({ type: 'canceled', pendingId })
      } else {
        const error: ChatApiError = result.error ?? { kind: 'unknown', message: USER_MESSAGE.unknown, retryable: true }
        dispatch({ type: 'failed', pendingId, error })
      }
    },
    [client],
  )

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || stateRef.current.status === 'sending') return
      const pendingId = genId()
      dispatch({ type: 'send', userId: genId(), pendingId, text: trimmed, at: Date.now() })
      void run(trimmed, pendingId)
    },
    [run],
  )

  const retry = useCallback((): void => {
    if (stateRef.current.status === 'sending') return
    const lastUser = [...stateRef.current.messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    const pendingId = genId()
    dispatch({ type: 'resend', pendingId, at: Date.now() })
    void run(lastUser.content, pendingId)
  }, [run])

  const cancel = useCallback((): void => {
    controllerRef.current?.abort()
  }, [])

  const clear = useCallback((): void => {
    controllerRef.current?.abort()
    dispatch({ type: 'clear' })
  }, [])

  const reset = useCallback((): void => {
    controllerRef.current?.abort()
    dispatch({ type: 'reset' })
  }, [])

  const lastError = useMemo<ChatApiError | null>(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const e = state.messages[i].error
      if (e) return e
    }
    return null
  }, [state.messages])

  return {
    messages: state.messages,
    conversationId: state.conversationId,
    isSending: state.status === 'sending',
    lastError,
    send,
    retry,
    cancel,
    clear,
    reset,
  }
}
