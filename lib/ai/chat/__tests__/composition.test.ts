/**
 * @module lib/ai/chat/__tests__/composition.test
 * Composition root — DI wiring + config guard (+ opt-in real-warehouse build).
 */

import { existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { createProviderRegistry } from '@/lib/ai/llm'
import { ChatConfigError, buildChatService } from '@/lib/ai/chat'
import { citingProvider } from './support'

describe('buildChatService — configuration', () => {
  it('throws ChatConfigError when no data directory is configured', () => {
    expect(() => buildChatService({ env: {} })).toThrow(ChatConfigError)
  })
})

const DIR = process.env.CYC_DATA_DIR

describe.skipIf(!DIR || !existsSync(DIR))('buildChatService — real warehouse DI', () => {
  it('wires the full graph and serves a request', async () => {
    // Register the grounding provider under "openai" and select it via env.
    const registry = createProviderRegistry([citingProvider('openai')])
    const service = buildChatService({
      dataDir: DIR,
      env: { AI_PROVIDER: 'openai' },
      providerRegistry: registry,
    })
    const outcome = await service.handle({ message: 'which college has the best placements?' })
    expect(outcome.httpStatus).toBe(200)
    expect((outcome.body as { conversationId: string }).conversationId.length).toBeGreaterThan(0)
  })

  it('degrades to 503 when the selected provider is not registered', async () => {
    const service = buildChatService({ dataDir: DIR, env: { AI_PROVIDER: 'openai' } })
    const outcome = await service.handle({ message: 'recommend a college' })
    expect(outcome.httpStatus).toBe(503)
  })
})
