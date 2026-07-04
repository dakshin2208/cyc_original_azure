/**
 * @module lib/ai/chat/__tests__/support
 *
 * Test fixtures for the Chat API layer. Wires a {@link ChatService} over the
 * Sprint 4 orchestrator (fixture warehouse) with deterministic id/clock and
 * swappable provider doubles. Excluded from the production build.
 */

import {
  createFunctionProvider,
  createLLMAdapter,
  createStaticProvider,
  createUnavailableProvider,
  type CompletionResult,
  type LLMProvider,
} from '@/lib/ai/llm'
import {
  createChatService,
  createInMemorySessionStore,
  createRecordingLogger,
  type ChatService,
  type RecordingLogger,
  type SessionStore,
} from '@/lib/ai/chat'
import { makeHarness } from '../../orchestration/__tests__/support'

const { ai } = makeHarness()

/** The shared fixture orchestrator (deterministic, over the compact warehouse). */
export const orchestrator = ai

/**
 * A provider that grounds itself: it extracts the first evidence id from the
 * prompt and cites it, returning a valid, non-fabricating JSON reply.
 */
export function citingProvider(name = 'mock'): LLMProvider {
  return createFunctionProvider(name, (req) => {
    const text = req.messages.map((m) => m.content).join('\n')
    const match = text.match(/\[([a-z0-9-]+)\]/i)
    const id = match?.[1] ?? null
    const body = {
      answer: 'Based on the supplied data, here is a grounded summary.',
      citations: id ? [{ evidenceId: id, collegeName: null, label: 'evidence', source: 'retrieval' }] : [],
      followUps: [],
      confidence: 'high',
      hadMissingInformation: false,
    }
    return { text: JSON.stringify(body) }
  })
}

/** A provider that never resolves (for timeout tests). */
export function hangingProvider(name = 'hang'): LLMProvider {
  return createFunctionProvider(name, () => new Promise<CompletionResult>(() => undefined))
}

/** A provider that returns a fixed raw string (may be non-JSON). */
export function textProvider(text: string, name = 'text'): LLMProvider {
  return createStaticProvider(name, text)
}

/** A provider whose reply cites a fabricated evidence id (forces rejection). */
export function jsonRejectProvider(name = 'reject'): LLMProvider {
  return createStaticProvider(
    name,
    JSON.stringify({
      answer: 'Trust me on this.',
      citations: [{ evidenceId: 'totally-made-up-id', collegeName: null, label: 'x', source: 'retrieval' }],
      confidence: 'high',
    }),
  )
}

/** A deterministic incrementing id generator. */
export function idSequence(prefix = 'conv'): () => string {
  let i = 0
  return () => `${prefix}-${(i += 1)}`
}

/** Options for {@link makeService}. */
export interface MakeServiceOptions {
  readonly provider?: LLMProvider
  readonly store?: SessionStore
  readonly timeoutMs?: number
  readonly idGenerator?: () => string
  readonly maxMessageLength?: number
}

/** Build a chat service with test defaults (deterministic clock + ids). */
export function makeService(options: MakeServiceOptions = {}): {
  service: ChatService
  store: SessionStore
  logger: RecordingLogger
} {
  const store = options.store ?? createInMemorySessionStore()
  const logger = createRecordingLogger()
  const service = createChatService({
    orchestrator: ai,
    adapter: createLLMAdapter(options.provider ?? citingProvider()),
    sessionStore: store,
    logger,
    clock: () => 0,
    idGenerator: options.idGenerator ?? idSequence(),
    timeoutMs: options.timeoutMs ?? 1000,
    maxMessageLength: options.maxMessageLength,
  })
  return { service, store, logger }
}

export { createStaticProvider, createUnavailableProvider }
