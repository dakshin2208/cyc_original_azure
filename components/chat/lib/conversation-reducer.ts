/**
 * @module components/chat/lib/conversation-reducer
 *
 * The single source of truth for conversation UI state — a pure reducer. It holds
 * `conversationId`, the ordered `messages` (each carrying its own citations /
 * follow-ups / confidence / error), and a coarse `status`. No other component
 * duplicates this state. Pure and deterministic (ids/timestamps come from the
 * action), so it is fully node-testable without React.
 */

import type { ChatApiError, ChatMessage, ChatResponse } from './types'

/** The conversation UI state. */
export interface ConversationState {
  readonly conversationId: string | null
  readonly messages: readonly ChatMessage[]
  readonly status: 'idle' | 'sending'
}

/** The empty initial state. */
export const initialConversationState: ConversationState = {
  conversationId: null,
  messages: [],
  status: 'idle',
}

/** All state transitions. */
export type ConversationAction =
  | { readonly type: 'send'; readonly userId: string; readonly pendingId: string; readonly text: string; readonly at: number }
  | { readonly type: 'resend'; readonly pendingId: string; readonly at: number }
  | { readonly type: 'received'; readonly pendingId: string; readonly response: ChatResponse; readonly at: number }
  | { readonly type: 'failed'; readonly pendingId: string; readonly error: ChatApiError }
  | { readonly type: 'canceled'; readonly pendingId: string }
  | { readonly type: 'clear' }
  | { readonly type: 'reset' }

const pending = (id: string, at: number): ChatMessage => ({
  id,
  role: 'assistant',
  content: '',
  status: 'sending',
  createdAt: at,
})

/** Apply an action to the conversation state. */
export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'send': {
      const userMessage: ChatMessage = {
        id: action.userId,
        role: 'user',
        content: action.text,
        status: 'complete',
        createdAt: action.at,
      }
      return {
        ...state,
        status: 'sending',
        messages: [...state.messages, userMessage, pending(action.pendingId, action.at)],
      }
    }

    case 'resend':
      // Replace a trailing errored assistant message with a fresh pending one
      // (the preceding user message is kept, so its text can be resent).
      return {
        ...state,
        status: 'sending',
        messages: [...dropLastErroredAssistant(state.messages), pending(action.pendingId, action.at)],
      }

    case 'received': {
      const { response } = action
      return {
        conversationId: response.conversationId,
        status: 'idle',
        messages: state.messages.map((m) =>
          m.id === action.pendingId
            ? {
                id: m.id,
                role: 'assistant',
                content: response.answer,
                status: 'complete',
                createdAt: action.at,
                citations: response.citations,
                followUps: response.followUps,
                confidence: response.confidence,
              }
            : m,
        ),
      }
    }

    case 'failed':
      return {
        ...state,
        status: 'idle',
        messages: state.messages.map((m) =>
          m.id === action.pendingId
            ? { ...m, status: 'error', content: '', error: action.error }
            : m,
        ),
      }

    case 'canceled':
      return {
        ...state,
        status: 'idle',
        messages: state.messages.filter((m) => m.id !== action.pendingId),
      }

    case 'clear':
      // Blank the visible transcript but keep the backend session (conversationId).
      return { ...state, messages: [], status: 'idle' }

    case 'reset':
      // Start a brand-new conversation (drop the backend session too).
      return { ...initialConversationState }

    default:
      return state
  }
}

/** Drop a trailing errored assistant message, if present. */
function dropLastErroredAssistant(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'error') return messages.slice(0, -1)
  return messages
}
