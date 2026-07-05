/**
 * @module lib/ai/chat/__tests__/session-store.test
 * In-memory session store — async CRUD + bounded LRU eviction.
 */

import { describe, expect, it } from 'vitest'
import { sessionId } from '@/lib/ai/shared'
import { createConversationState, type ConversationState } from '@/lib/ai/orchestration'
import { createInMemorySessionStore } from '@/lib/ai/chat'

const state = (id: string): ConversationState => createConversationState(sessionId(id))

describe('in-memory session store', () => {
  it('supports async get / set / has / delete / size', async () => {
    const store = createInMemorySessionStore()
    expect(await store.has('a')).toBe(false)
    await store.set('a', state('a'))
    expect(await store.has('a')).toBe(true)
    expect((await store.get('a'))?.sessionId).toBe('a')
    expect(await store.size()).toBe(1)
    await store.delete('a')
    expect(await store.has('a')).toBe(false)
  })

  it('returns undefined for an unknown id', async () => {
    expect(await createInMemorySessionStore().get('missing')).toBeUndefined()
  })

  it('evicts the least-recently-used entry past the cap', async () => {
    const store = createInMemorySessionStore({ maxEntries: 2 })
    await store.set('a', state('a'))
    await store.set('b', state('b'))
    await store.get('a') // touch 'a' → 'b' becomes LRU
    await store.set('c', state('c')) // evicts 'b'
    expect(await store.has('a')).toBe(true)
    expect(await store.has('b')).toBe(false)
    expect(await store.has('c')).toBe(true)
    expect(await store.size()).toBe(2)
  })
})
