/**
 * @module lib/ai/chat/counselor-chat-service
 *
 * The counselor-grade chat service — the integration that routes `/api/chat`
 * through the full pipeline WITH the LLM as the final reasoning layer:
 *
 *   validate → load session/history → OpinionService.advise
 *     ( Retriever → Recommendation Engine → Opinion Engine → LLM reasoning )
 *   → persist session/history → map to the chat HTTP contract
 *
 * It implements the SAME {@link ChatService} interface as the Sprint-6 service, so
 * the route/container are unchanged. It DELEGATES all business logic to the reused
 * {@link OpinionService} (Sprint 8) — it duplicates none. Because the opinion layer
 * always returns a grounded answer (LLM-reasoned, or a deterministic fallback when
 * the model is unavailable/hallucinates), this path returns HTTP 200 with a safe
 * answer rather than the Sprint-6 503. No AI logic lives here — only HTTP glue.
 */

import { randomUUID } from 'crypto'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup, type CutoffLookup } from '@/lib/recommendation'
import type { ConversationState } from '@/lib/ai/orchestration'
import { composeCounselorSystem, resolveConfiguredProvider, type LLMProvider } from '@/lib/ai/llm'
import {
  createOpinionService,
  type ConversationTurn,
  type OpinionConfig,
  type OpinionService,
} from '@/lib/opinion'
import type { ChatService } from './chat-service'
import type { ChatOutcome, ChatResponse } from './dto'
import { ChatConfigError, HTTP_STATUS, SAFE_MESSAGE, TimeoutError, type ChatErrorCode } from './errors'
import { createConsoleLogger, type ChatLogger } from './logger'
import { createInMemorySessionStore, type SessionStore } from './session-store'
import {
  createInMemoryProfileStore,
  emptyProfile,
  isComplete,
  mergeMessage,
  nextMissingSlot,
  PROFILE_SLOTS,
  profileSummary,
  profilesEqual,
  slotPrompt,
  toOverrides,
  toView,
  type ProfileStore,
  type StudentProfile,
} from './profile'

type Env = Record<string, string | undefined>

/** Dependencies for the counselor chat service. */
export interface CounselorChatServiceDeps {
  readonly opinion: OpinionService
  readonly sessionStore: SessionStore
  /**
   * When present, the service runs the conversational profile layer: it collects
   * the student profile (cutoff → community → district → branch) before answering,
   * then uses the stored profile on every later question. When absent, the service
   * answers immediately (the original behavior).
   */
  readonly profileStore?: ProfileStore
  readonly logger: ChatLogger
  readonly clock: () => number
  readonly idGenerator: () => string
  readonly timeoutMs: number
  readonly maxMessageLength?: number
  /** Turn-text history kept in memory per conversation (default 6 turns). */
  readonly maxHistoryTurns?: number
  /** Max conversations to retain turn-text history for (default 1000). */
  readonly maxHistoryConversations?: number
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Whether a message ASKS something (vs. merely providing a profile slot value or a
 * profile update). Uses explicit question markers so a bare slot answer ("cse",
 * "190") or an update ("my cutoff is 187") is NOT treated as a question.
 */
const QUESTION_RE =
  /\?|\b(what|which|who|where|how|why|recommend|recommendation|recommendations|suggest|compare|versus|best|top|placement|placements|salary|package|roi|research|faculty|nirf|eligib|can i (get|join)|will i (get|join)|should i)\b/i

/** Warm first-contact greeting (shown once, before the first slot prompt). */
const WELCOME =
  "Hi! I'm your Tamil Nadu Engineering admission counsellor — I'll help you find colleges that fit your rank and goals. Let's start with a few quick details."
/** Recommendation query used to counsel the moment the profile is complete/updated. */
const RECOMMEND_TRIGGER = 'recommend the best colleges for me'
/** A parent (rather than the student) is talking — switch to a reassuring tone. */
const PARENT_RE = /\bmy (son|daughter|child|kid|ward|boy|girl)\b|\bour (son|daughter|child|kid)\b|\bfor my\b|\bwe are (planning|looking)\b/i

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!ms || ms <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** Create the counselor chat service (delegates reasoning to the Opinion Engine). */
export function createCounselorChatService(deps: CounselorChatServiceDeps): ChatService {
  const maxLen = deps.maxMessageLength ?? 2000
  const maxTurns = deps.maxHistoryTurns ?? 6
  const maxConversations = deps.maxHistoryConversations ?? 1000
  // In-memory, request/session-scoped turn-text history (no database).
  const history = new Map<string, ConversationTurn[]>()

  const rememberTurn = (id: string, userText: string, assistantText: string): void => {
    const prior = history.get(id) ?? []
    const next = [...prior, { role: 'user', content: userText }, { role: 'assistant', content: assistantText }].slice(
      -maxTurns * 2,
    ) as ConversationTurn[]
    history.delete(id)
    history.set(id, next)
    while (history.size > maxConversations) {
      const oldest = history.keys().next().value
      if (oldest === undefined) break
      history.delete(oldest)
    }
  }

  const errorOutcome = (code: ChatErrorCode, conversationId: string | null): ChatOutcome => ({
    httpStatus: HTTP_STATUS[code],
    body: { error: SAFE_MESSAGE[code], code, conversationId },
  })

  /** Answer via the reasoning pipeline (optionally with a profile's overrides). */
  const answer = async (
    message: string,
    id: string,
    priorState: ConversationState | undefined,
    priorHistory: readonly ConversationTurn[],
    profile: StudentProfile | undefined,
    intro?: string,
  ): Promise<ChatOutcome> => {
    const startedAt = deps.clock()
    let advised: { response: import('@/lib/opinion').OpinionResponse; state: ConversationState }
    try {
      advised = await withTimeout(
        deps.opinion.advise(message, {
          priorState,
          history: priorHistory,
          overrides: profile ? toOverrides(profile) : undefined,
        }),
        deps.timeoutMs,
      )
    } catch (e) {
      const code: ChatErrorCode = e instanceof TimeoutError ? 'timeout' : 'internal_error'
      deps.logger.log({ event: 'error', conversationId: id, code, latencyMs: deps.clock() - startedAt, httpStatus: HTTP_STATUS[code] })
      return errorOutcome(code, id)
    }
    const latencyMs = deps.clock() - startedAt

    await deps.sessionStore.set(id, advised.state)
    rememberTurn(id, message, advised.response.answer)
    deps.logger.log({
      event: 'llm',
      conversationId: id,
      llmStatus: advised.response.usedModel ? 'model' : 'deterministic',
      intent: advised.response.strategy,
      fallback: !advised.response.usedModel,
      latencyMs,
    })

    const body: ChatResponse = {
      answer: intro ? `${intro}\n\n${advised.response.answer}` : advised.response.answer,
      citations: advised.response.evidence,
      confidence: advised.response.confidence,
      followUps: advised.response.followUps,
      conversationId: id,
      ...(profile
        ? { profile: toView(profile), stage: isComplete(profile) ? ('ready' as const) : ('collecting' as const) }
        : {}),
    }
    deps.logger.log({ event: 'response', conversationId: id, httpStatus: 200, llmStatus: advised.response.usedModel ? 'model' : 'deterministic' })
    return { httpStatus: 200, body }
  }

  const handle = async (payload: unknown): Promise<ChatOutcome> => {
    // 1. Validate.
    if (!isRecord(payload) || typeof payload.message !== 'string') {
      deps.logger.log({ event: 'error', code: 'invalid_request', httpStatus: 400 })
      return errorOutcome('invalid_request', null)
    }
    const message = payload.message.trim()
    const conversationId =
      typeof payload.conversationId === 'string' && payload.conversationId.trim().length > 0
        ? payload.conversationId.trim()
        : null
    if (message.length === 0) return errorOutcome('empty_message', conversationId)
    if (message.length > maxLen) return errorOutcome('message_too_long', conversationId)

    // 2. Load session + turn history.
    const id = conversationId ?? deps.idGenerator()
    const priorState = conversationId ? await deps.sessionStore.get(conversationId) : undefined
    const priorHistory = history.get(id) ?? []
    deps.logger.log({ event: 'request', conversationId: id, messageLength: message.length })

    // 3a. No profile store → answer immediately (original behavior; existing callers).
    if (!deps.profileStore) return answer(message, id, priorState, priorHistory, undefined)

    // 3b. Conversational profile layer: collect the profile, then answer using it.
    const priorProfile = (conversationId ? await deps.profileStore.get(conversationId) : undefined) ?? emptyProfile()
    const parsed = deps.opinion.parse(message)

    // Domain / unknown-entity guards apply at ANY stage — decline immediately rather
    // than collecting a profile for a query the warehouse cannot serve.
    if (parsed.outOfDomain !== null || parsed.unverifiedCollege) {
      return answer(message, id, priorState, priorHistory, priorProfile)
    }

    const wasComplete = isComplete(priorProfile)
    const hasQuestion = QUESTION_RE.test(parsed.normalized)
    // Profile protection (#3): once the profile is complete, a QUESTION never mutates it
    // — only an explicit statement ("show ECE", "actually my cutoff is 187") updates a
    // field. During collection every message is merged so the slots fill.
    const profile = wasComplete && hasQuestion ? priorProfile : mergeMessage(priorProfile, parsed, message)
    await deps.profileStore.set(id, profile)

    const finish = (text: string, stage: 'collecting' | 'ready'): ChatOutcome => {
      rememberTurn(id, message, text)
      deps.logger.log({ event: 'response', conversationId: id, httpStatus: 200, llmStatus: 'profile' })
      return {
        httpStatus: 200,
        body: { answer: text, citations: [], confidence: 'low', followUps: [], conversationId: id, profile: toView(profile), stage },
      }
    }

    // Still collecting → ask the next slot; welcome the student on first contact (#1).
    const missing = nextMissingSlot(profile)
    if (missing) {
      const firstContact = PROFILE_SLOTS.every((s) => !priorProfile.answered[s])
      const prompt =
        missing === 'cutoff' && firstContact ? `${WELCOME}\n\n${slotPrompt('cutoff')}` : slotPrompt(missing)
      return finish(prompt, 'collecting')
    }

    // Parent mode (#4): a reassuring tone when a parent is talking, in this message or
    // earlier in the conversation.
    const isParent = PARENT_RE.test(message) || priorHistory.some((t) => t.role === 'user' && PARENT_RE.test(t.content))
    const summary = profileSummary(profile).replace(/\n/g, ' · ')

    // Profile complete → act like a counselor (#4): give guidance immediately instead of
    // asking "what would you like to know?".
    if (!wasComplete) {
      const intro = isParent
        ? `Thanks for sharing your child's details — I know this decision feels big. Here's how I'd guide them (${summary}). I'll flag which colleges are realistic, which are a reach, and a couple of safe backups:`
        : `Thanks — that's everything I need. Here's my guidance for you (${summary}):`
      return answer(RECOMMEND_TRIGGER, id, priorState, priorHistory, profile, intro)
    }
    // A real follow-up question with a complete profile → answer it directly.
    if (hasQuestion) return answer(message, id, priorState, priorHistory, profile)
    // An explicit profile change (no question) → re-counsel with the updated profile.
    if (!profilesEqual(priorProfile, profile)) {
      const intro = isParent ? `Understood — I've updated that. Here's my revised guidance for your child:` : `Got it — I've updated that. Here's my revised guidance:`
      return answer(RECOMMEND_TRIGGER, id, priorState, priorHistory, profile, intro)
    }
    // Complete, no question, no change (e.g. "ok", "thanks").
    return finish(`Happy to help further — ask about placements, compare two colleges, or I can suggest safer backup options.`, 'ready')
  }

  return Object.freeze({ handle })
}

/** Options for building the counselor chat service. */
export interface BuildCounselorChatServiceOptions {
  readonly dataDir?: string
  readonly env?: Env
  readonly cutoffs?: CutoffLookup
  readonly sessionStore?: SessionStore
  /** Per-conversation profile store (default: in-memory). Enables the profile layer. */
  readonly profileStore?: ProfileStore
  readonly logger?: ChatLogger
  readonly clock?: () => number
  readonly idGenerator?: () => string
  readonly opinionConfig?: Partial<OpinionConfig>
  /** Override the LLM provider (tests). Defaults to the env-configured OpenAI provider. */
  readonly provider?: LLMProvider
  readonly systemPrompt?: string
  readonly timeoutMs?: number
  readonly maxMessageLength?: number
}

/**
 * Compose the counselor chat service: Warehouse → Repositories → Retrieval →
 * Opinion Service (Recommendation + Opinion + LLM). Throws {@link ChatConfigError}
 * on misconfiguration. Uses the env-configured OpenAI provider; with no key it
 * degrades to the deterministic grounded answer.
 */
export function buildCounselorChatService(options: BuildCounselorChatServiceOptions = {}): ChatService {
  const env = options.env ?? process.env
  const dataDir = options.dataDir ?? env.CYC_DATA_DIR
  if (!dataDir) {
    throw new ChatConfigError('warehouse data directory is not configured (set CYC_DATA_DIR)')
  }

  const warehouse = buildWarehouseFromDirectory(dataDir)
  const repos = createRepositories(warehouse)
  const retrieval = createRetrievalEngine(repos)
  const provider = options.provider ?? resolveConfiguredProvider(env)
  const systemPrompt = options.systemPrompt ?? composeCounselorSystem()

  // Eligibility (RC4/M6): community-aware closing cutoffs — a reserved student is
  // banded on their OWN community's TNEA marks, falling back to the OC cutoff.
  const cutoffs = options.cutoffs ?? createCommunityCutoffLookup(repos)

  const opinion = createOpinionService(repos, retrieval, {
    provider,
    cutoffs,
    config: options.opinionConfig,
    systemPrompt,
  })

  const parsedTimeout = Number(env.COUNSELOR_TIMEOUT_MS)
  const timeoutMs = options.timeoutMs ?? (Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 45_000)

  return createCounselorChatService({
    opinion,
    sessionStore: options.sessionStore ?? createInMemorySessionStore(),
    profileStore: options.profileStore ?? createInMemoryProfileStore(),
    logger: options.logger ?? createConsoleLogger(),
    clock: options.clock ?? Date.now,
    idGenerator: options.idGenerator ?? (() => randomUUID()),
    timeoutMs,
    maxMessageLength: options.maxMessageLength,
  })
}
