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

// ── Orchestration Brain (route selection; decides, does not execute) ─────────
export {
  type CounselorDecision,
  type BrainContext,
  decideTurn,
  refinementTrigger,
} from './counselor-brain'

// ── Conversational memory (co-reference: "it", "the top two you just mentioned") ──
export {
  type ConversationMemory,
  EMPTY_MEMORY,
  readMemory,
  resolveReference,
} from './conversation-memory'

// ── LLM planner (owns understanding for hard turns; falls back to the classifier) ──
export {
  type CounselorPlan,
  type CounselorPlanner,
  type PlannerAction,
  type PlannedAction,
  PLANNER_ACTIONS,
  ABBREVIATION_ALIASES,
  expandCollegeWord,
  parsePlan,
  translatePlan,
  createCounselorPlanner,
} from './planner'

// ── Capability Registry (dispatch a decision → its capability handler) ───────
export {
  type CapabilityContext,
  type CapabilityHandler,
  type CapabilityRegistry,
  createCapabilityRegistry,
  createDefaultCapabilityRegistry,
  nextStep,
  preferenceListIntro,
} from './capability-registry'

// ── Trust Pipeline (Evidence → Grounding → Validation → Narration → Response) ─
export {
  type TrustPipeline,
  type TrustResult,
  type TrustRunOptions,
  createOpinionTrustPipeline,
} from './trust-pipeline'

// ── Analytics & Observability (privacy-safe product events; side-effect only) ─
export {
  type AnalyticsEvent,
  type AnalyticsSink,
  type RecordingAnalytics,
  type TurnAnalyticsInput,
  createConsoleAnalytics,
  createNullAnalytics,
  createRecordingAnalytics,
  isClosingMessage,
  turnAnalyticsEvents,
} from './analytics'

// ── Session store (async; in-memory or Supabase-backed) ──────────────────────
export {
  type SessionStore,
  type InMemoryStoreOptions,
  createInMemorySessionStore,
  createSupabaseSessionStore,
  createConfiguredSessionStore,
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

// ── AI-chat auth + per-plan question-limit guard (production integration) ─────
export {
  type ChatUsageGuard,
  type ChatUsageStore,
  type GuardOutcome,
  ChatUsageGuardConfigError,
  withinLimit,
  bearerToken,
  usageDay,
  createChatUsageGuard,
  createSupabaseChatUsageStore,
  createSupabaseChatUsageGuard,
  getChatUsageGuard,
  setChatUsageGuardOverride,
  resetChatUsageGuard,
} from './usage-guard'

// ── Counselor chat service (LLM reasoning layer — the live /api/chat path) ────
export {
  type CounselorChatServiceDeps,
  type BuildCounselorChatServiceOptions,
  createCounselorChatService,
  buildCounselorChatService,
} from './counselor-chat-service'

// ── Conversational student-profile layer ─────────────────────────────────────
export {
  PROFILE_SLOTS,
  type ProfileSlot,
  type StudentProfile,
  type StudentProfileView,
  type ProfileStore,
  type InMemoryProfileStoreOptions,
  emptyProfile,
  isComplete,
  nextMissingSlot,
  profilesEqual,
  mergeMessage,
  toOverrides,
  toView,
  slotPrompt,
  profileSummary,
  createInMemoryProfileStore,
  createSupabaseProfileStore,
  createConfiguredProfileStore,
  resolveDistrict,
} from './profile'
