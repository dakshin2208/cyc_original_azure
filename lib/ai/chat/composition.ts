/**
 * @module lib/ai/chat/composition
 *
 * The composition root — the ONE place that constructs the dependency graph:
 *
 *   Warehouse → Repositories → Retrieval Engine → Recommendation + Comparison
 *   Engines (inside the Orchestrator) → AI Orchestrator (S4) → LLM Adapter (S5)
 *   → Chat Service.
 *
 * Everything is wired by explicit dependency injection; the route never
 * constructs anything itself. Provider selection is env-driven and swappable.
 * No AI logic lives here — only wiring.
 */

import { randomUUID } from 'crypto'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import type { CutoffLookup } from '@/lib/recommendation'
import { createAIOrchestrator } from '@/lib/ai/orchestration'
import { createLLMAdapter, type AdapterConfig, type ProviderRegistry } from '@/lib/ai/llm'
import { createChatService, type ChatService } from './chat-service'
import { ChatConfigError } from './errors'
import { createConsoleLogger, type ChatLogger } from './logger'
import { readProviderConfig, resolveProvider } from './provider-config'
import { createInMemorySessionStore, type SessionStore } from './session-store'

type Env = Record<string, string | undefined>

/** Options for building the chat service (all optional; sensible prod defaults). */
export interface BuildChatServiceOptions {
  /** Warehouse CSV directory (defaults to `CYC_DATA_DIR`). */
  readonly dataDir?: string
  /** Environment source (defaults to `process.env`). */
  readonly env?: Env
  /** Registered LLM providers (empty by default → graceful "unavailable"). */
  readonly providerRegistry?: ProviderRegistry
  /** Replaceable session store (defaults to in-memory). */
  readonly sessionStore?: SessionStore
  readonly logger?: ChatLogger
  readonly clock?: () => number
  readonly idGenerator?: () => string
  readonly adapterConfig?: Partial<AdapterConfig>
  /** Injectable historical-cutoff source for eligibility (S3). */
  readonly cutoffs?: CutoffLookup
  readonly maxMessageLength?: number
}

/** Build the fully-wired {@link ChatService}. Throws {@link ChatConfigError} on misconfig. */
export function buildChatService(options: BuildChatServiceOptions = {}): ChatService {
  const env = options.env ?? process.env
  const dataDir = options.dataDir ?? env.CYC_DATA_DIR
  if (!dataDir) {
    throw new ChatConfigError('warehouse data directory is not configured (set CYC_DATA_DIR)')
  }

  // Warehouse → Repositories → Retrieval → (Recommendation + Comparison via) Orchestrator.
  const repos = createRepositories(buildWarehouseFromDirectory(dataDir))
  const retrieval = createRetrievalEngine(repos)
  const orchestrator = createAIOrchestrator(repos, retrieval, { cutoffs: options.cutoffs })

  // Env-driven, swappable provider → LLM Adapter.
  const providerConfig = readProviderConfig(env)
  const provider = resolveProvider(providerConfig, options.providerRegistry)
  const adapter = createLLMAdapter(provider, options.adapterConfig)

  return createChatService({
    orchestrator,
    adapter,
    sessionStore: options.sessionStore ?? createInMemorySessionStore(),
    logger: options.logger ?? createConsoleLogger(),
    clock: options.clock ?? Date.now,
    idGenerator: options.idGenerator ?? (() => randomUUID()),
    timeoutMs: providerConfig.timeoutMs,
    maxMessageLength: options.maxMessageLength,
  })
}
