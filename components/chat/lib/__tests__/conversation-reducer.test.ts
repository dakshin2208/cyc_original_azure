/**
 * @module components/chat/lib/__tests__/conversation-reducer.test
 * Pure conversation reducer — single source of truth, immutable transitions.
 */

import { describe, expect, it } from 'vitest'
import {
  conversationReducer,
  initialConversationState,
  type ConversationState,
} from '../conversation-reducer'
import type { ChatApiError, ChatResponse } from '../types'

const sent = (): ConversationState =>
  conversationReducer(initialConversationState, { type: 'send', userId: 'u1', pendingId: 'a1', text: 'hi', at: 1 })

const RESPONSE: ChatResponse = {
  answer: 'Here is the answer.',
  citations: [{ evidenceId: 'e1', collegeName: 'PSG', label: 'Median salary', source: 'retrieval' }],
  confidence: 'high',
  followUps: [{ question: 'Which branch?', expects: 'branch', reason: 'branch-specific' }],
  conversationId: 'conv-42',
}

describe('conversation reducer', () => {
  it('send appends a user message and a pending assistant message', () => {
    const s = sent()
    expect(s.status).toBe('sending')
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(s.messages[1].status).toBe('sending')
  })

  it('received fills the pending message and records the conversationId', () => {
    const s = conversationReducer(sent(), { type: 'received', pendingId: 'a1', response: RESPONSE, at: 2 })
    expect(s.status).toBe('idle')
    expect(s.conversationId).toBe('conv-42')
    const assistant = s.messages[1]
    expect(assistant.content).toBe('Here is the answer.')
    expect(assistant.citations).toHaveLength(1)
    expect(assistant.followUps).toHaveLength(1)
    expect(assistant.confidence).toBe('high')
    expect(assistant.status).toBe('complete')
  })

  it('failed marks the pending message as an error', () => {
    const error: ChatApiError = { kind: 'server', message: 'oops', retryable: true }
    const s = conversationReducer(sent(), { type: 'failed', pendingId: 'a1', error })
    expect(s.status).toBe('idle')
    expect(s.messages[1].status).toBe('error')
    expect(s.messages[1].error?.kind).toBe('server')
  })

  it('canceled removes the pending message', () => {
    const s = conversationReducer(sent(), { type: 'canceled', pendingId: 'a1' })
    expect(s.status).toBe('idle')
    expect(s.messages.map((m) => m.role)).toEqual(['user'])
  })

  it('resend replaces a trailing errored assistant with a fresh pending', () => {
    const failed = conversationReducer(sent(), { type: 'failed', pendingId: 'a1', error: { kind: 'timeout', message: 't', retryable: true } })
    const s = conversationReducer(failed, { type: 'resend', pendingId: 'a2', at: 3 })
    expect(s.status).toBe('sending')
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(s.messages[1].id).toBe('a2')
    expect(s.messages[1].status).toBe('sending')
  })

  it('clear empties the transcript but keeps the conversationId', () => {
    const done = conversationReducer(sent(), { type: 'received', pendingId: 'a1', response: RESPONSE, at: 2 })
    const s = conversationReducer(done, { type: 'clear' })
    expect(s.messages).toHaveLength(0)
    expect(s.conversationId).toBe('conv-42')
  })

  it('reset starts a brand-new conversation', () => {
    const done = conversationReducer(sent(), { type: 'received', pendingId: 'a1', response: RESPONSE, at: 2 })
    const s = conversationReducer(done, { type: 'reset' })
    expect(s).toEqual(initialConversationState)
  })

  it('never mutates the previous state', () => {
    const before = sent()
    const snapshot = JSON.stringify(before)
    conversationReducer(before, { type: 'received', pendingId: 'a1', response: RESPONSE, at: 2 })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
