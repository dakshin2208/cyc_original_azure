/**
 * @module lib/ai/chat
 *
 * Public API of the Chat API integration layer (Sprint 6). It composes the full
 * deterministic pipeline — AI Orchestrator (S4) → LLM Adapter (S5) — behind a
 * framework-agnostic {@link ChatService}, plus the DI composition root, an async
 * (Redis-replaceable) session store, env-driven provider selection, structured
 * logging, and the HTTP DTOs. It contains NO React, NO streaming, NO database,
 * NO auth, and imports NO provider SDK. The Next.js route is a thin adapter over
 * `getChatService()`.
 */

// ── HTTP DTOs ────────────────────────────────────────────────────────────────
export type { ChatRequest, ChatResponse, ChatErrorBody, ChatOutcome } from './dto'

// ── Errors + status mapping ──────────────────────────────────────────────────
export {
  type ChatErrorCode,
  HTTP_STATUS,
  SAFE_MESSAGE,
  TimeoutError,
  ChatConfigError,
  errorCodeForLLMStatus,
} from './errors'

// ── Session store (async; Redis-replaceable) ─────────────────────────────────
export {
  type SessionStore,
  type InMemoryStoreOptions,
  createInMemorySessionStore,
} from './session-store'

// ── Structured logging ───────────────────────────────────────────────────────
export {
  type ChatLogEvent,
  type ChatLogger,
  type RecordingLogger,
  createConsoleLogger,
  createNullLogger,
  createRecordingLogger,
} from './logger'

// ── Provider configuration (env-driven, swappable) ───────────────────────────
export {
  type ProviderName,
  type ProviderConfig,
  readProviderConfig,
  resolveProvider,
} from './provider-config'

// ── Chat service (conversation manager) ──────────────────────────────────────
export { type ChatServiceDeps, type ChatService, createChatService } from './chat-service'

// ── Composition root + container ─────────────────────────────────────────────
export { type BuildChatServiceOptions, buildChatService } from './composition'
export { getChatService, setChatServiceOverride, resetChatService } from './container'

// ── Counselor chat service (LLM reasoning layer — the live /api/chat path) ────
export {
  type CounselorChatServiceDeps,
  type BuildCounselorChatServiceOptions,
  createCounselorChatService,
  buildCounselorChatService,
} from './counselor-chat-service'
