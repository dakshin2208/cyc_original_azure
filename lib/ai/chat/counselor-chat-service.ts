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
import { createCommunityCutoffLookup, createRecommendationEngine, type CutoffLookup } from '@/lib/recommendation'
import type { ConversationState } from '@/lib/ai/orchestration'
import { composeCounselorSystem, resolveConfiguredProvider, type LLMProvider } from '@/lib/ai/llm'
import {
  createOpinionService,
  type ConversationTurn,
  type OpinionConfig,
  type OpinionService,
} from '@/lib/opinion'
import { decideTurn } from './counselor-brain'
import { readMemory, resolveReference } from './conversation-memory'
import { createOpinionTrustPipeline } from './trust-pipeline'
import { createConsoleAnalytics, createNullAnalytics, isClosingMessage, turnAnalyticsEvents, type AnalyticsSink } from './analytics'
import { RECOMMEND_TRIGGER } from './constants'
import {
  createDefaultCapabilityRegistry,
  type CapabilityContext,
  type CapabilityRegistry,
} from './capability-registry'
import type { ChatService } from './chat-service'
import type { ChatOutcome, ChatResponse } from './dto'
import { ChatConfigError, HTTP_STATUS, SAFE_MESSAGE, TimeoutError, type ChatErrorCode } from './errors'
import { createConsoleLogger, type ChatLogger } from './logger'
import { createConfiguredSessionStore, createInMemorySessionStore, type SessionStore } from './session-store'
import {
  createConfiguredProfileStore,
  createInMemoryProfileStore,
  emptyProfile,
  isComplete,
  mergeMessage,
  profileEcho,
  resolveDistrict,
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
   * The capability registry that dispatches the brain's decision to its handler.
   * Defaults to {@link createDefaultCapabilityRegistry}; inject to add/replace a
   * capability (registration only — no orchestration change).
   */
  readonly capabilityRegistry?: CapabilityRegistry
  /**
   * When present, the service runs the conversational profile layer: it collects
   * the student profile (cutoff → community → district → branch) before answering,
   * then uses the stored profile on every later question. When absent, the service
   * answers immediately (the original behavior).
   */
  readonly profileStore?: ProfileStore
  readonly logger: ChatLogger
  /** Privacy-safe product/observability sink. Defaults to a no-op (analytics disabled). */
  readonly analytics?: AnalyticsSink
  readonly clock: () => number
  readonly idGenerator: () => string
  readonly timeoutMs: number
  readonly maxMessageLength?: number
  /** Turn-text history kept in memory per conversation (default 6 turns). */
  readonly maxHistoryTurns?: number
  /** Max conversations to retain turn-text history for (default 1000). */
  readonly maxHistoryConversations?: number
  /**
   * Normalize a typed district to a known one, tolerating misspellings
   * ("coimbaore" → "coimbatore"). Returns null when nothing is close enough (the
   * service then broadens the recommendation statewide). Absent → no normalization.
   */
  readonly resolveDistrict?: (input: string) => string | null
  /**
   * Deterministic directory listing: N ranked colleges in a city (optional branch), as a
   * numbered list. Returns null when the city is unknown to the warehouse. No profile involved.
   */
  readonly listColleges?: (city: string, count: number, branch: string | null) => string | null
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

/** A parent (rather than the student) is talking — switch to a reassuring tone. */
const PARENT_RE = /\bmy (son|daughter|child|kid|ward|boy|girl)\b|\bour (son|daughter|child|kid)\b|\bfor my\b|\bwe are (planning|looking)\b/i

// ── Refinement (#5): once the profile is complete, a follow-up can re-scope the
// SAME student without restarting — by college type ("government only"), by safety
// ("safer backups"), or by changing a slot in place ("switch to ECE", "actually
// 187"). Each maps to a CLEAN engine trigger; the raw wording (e.g. the word "safe",
// which the parser would mistake for a college name) never reaches the parser.
const CHANGE_RE =
  /\b(instead|actually|switch(?:ing)? to|change (?:it |that |my )?to|change my|make it|rather|no,? i (want|meant)|i meant|update (?:my|to))\b/i

/**
 * Is the message actually ASKING FOR COLLEGES?
 *
 * This gates the recommendation retry below. The retry exists because a genuine ask can be
 * phrased in a way the keyword table misses ("tell me the collage what i get", "options for
 * me") — those must still get colleges. But it fired on ANY un-understood message, so a
 * complete-profile parent asking "when is the TNEA deadline?" was answered with "my top
 * recommendation is Chennai Institute of Technology…" — a confident answer to a question
 * nobody asked, which is worse than admitting ignorance.
 *
 * A POSITIVE predicate, deliberately: the message must mention colleges/options/seats before
 * we are allowed to rewrite it into "recommend the best colleges for me". Anything else is
 * something we did not understand, and we say so. (Includes the "collage" misspelling, which
 * real users type constantly.)
 */
const RECOMMENDATION_ASK_RE =
  /\bcolleg\w*|\bcollag\w*|\boptions?\b|\bchoices?\b|\bsuggest\w*|\brecommend\w*|\bshortlist\b|\b(pick|choose|prefer|opt for|go for)\b|\bwhich (one|ones|should|shall|would|do|can)\b|\bwhere (should|can|do) (i|he|she|we|my)\b|\bwhat (can|should) (i|he|she|we) (get|pick|choose|join|take|do)\b|\b(i|he|she) (can|will|would) get\b|\bseats?\b|\badmission\b|\bfor me\b|\bfor my (son|daughter|child|kid|ward)\b/i

/**
 * Topics the official dataset simply does not cover — TNEA PROCESS, not college FACTS.
 * Only consulted when the engine already failed to answer AND the message isn't a college ask,
 * so it just picks the wording of the honest decline; it never routes a real question away.
 */
const UNSUPPORTED_TOPIC_RE =
  /\b(deadline|last date|due date|dates?|schedule|timeline)\b|\bwhen (is|are|do|does|will|can)\b|\b(document|documents|certificate|certificates|proof)\b|\b(apply|application|registration|register|form filling)\b|\b(round \d|counselling (round|process|procedure|schedule)|allotment|allot)\b|\bchange (my |his |her |the )?(branch|course|college)\b|\btransfer\b|\b(rule|rules|policy|procedure)\b/i

// Capability selection / clarification / refinement matchers were extracted to the
// Orchestration Brain (`./counselor-brain`), which owns the routing decision. The
// service only EXECUTES the decision the brain returns.

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
  // The single dispatch layer from a brain decision → its capability handler.
  const registry = deps.capabilityRegistry ?? createDefaultCapabilityRegistry()
  // The explicit trust boundary every reasoning-answer crosses (Evidence → Grounding →
  // Validation → Narration → Response). Delegates to the reused Opinion engine.
  const trust = createOpinionTrustPipeline(deps.opinion)
  // Privacy-safe product/observability sink (no-op unless configured). Side-effect only.
  const analytics = deps.analytics ?? createNullAnalytics()
  // In-memory, request/session-scoped turn-text history (no database).
  const history = new Map<string, ConversationTurn[]>()
  // Per-conversation set of colleges the student asked to exclude ("remove X"),
  // remembered across turns and applied on every later recommendation (#5).
  const excluded = new Map<string, Set<string>>()

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
    outro?: string,
  ): Promise<ChatOutcome> => {
    const startedAt = deps.clock()
    // Set when we answer with an honest "that's not in my data". Such a reply must NOT be
    // dressed in the counselling framing — a profile echo ("Based on your profile — Cutoff
    // 190 · OC …") and a "compare this with another college?" outro around "I don't have TNEA
    // deadlines" reads like the bot didn't hear the question.
    let declined = false
    let advised: { response: import('@/lib/opinion').OpinionResponse; state: ConversationState }
    try {
      const exSet = excluded.get(id)
      const exclude = exSet && exSet.size > 0 ? [...exSet] : undefined
      const overrides = profile ? { ...toOverrides(profile), exclude } : exclude ? { exclude } : undefined
      advised = await withTimeout(
        trust.run(message, { priorState, history: priorHistory, overrides }),
        deps.timeoutMs,
      )
      // Guarantee colleges: a complete profile must never get a "no evidence" deflection when
      // it ASKED FOR COLLEGES. The raw phrasing may not parse to a recommendation intent
      // ("tell me the collage what i get"), so retry with a RELIABLE recommendation query;
      // and if the DISTRICT still matches nothing, broaden across Tamil Nadu.
      //
      // The RECOMMENDATION_ASK_RE gate is the fix for a live bug: without it, ANY message the
      // classifier failed to understand was rewritten into "recommend the best colleges for
      // me". "when is the TNEA deadline?" and "can he change branch after first year?" both
      // came back as "my top recommendation is Chennai Institute of Technology…" — confidently
      // answering a question the parent never asked. If they didn't ask for colleges, we do not
      // hand them colleges; we say we don't know (below).
      const hasCols = (a: typeof advised): boolean =>
        a.response.recommendationSummary.some((s) => s.colleges.length > 0)
      if (
        profile &&
        isComplete(profile) &&
        advised.response.strategy === 'insufficient_evidence' &&
        RECOMMENDATION_ASK_RE.test(message)
      ) {
        const ov = { ...toOverrides(profile), exclude }
        let retry = await withTimeout(
          trust.run(RECOMMEND_TRIGGER, { priorState, history: priorHistory, overrides: ov }),
          deps.timeoutMs,
        )
        let note = ''
        if (!hasCols(retry) && profile.district) {
          const wide = await withTimeout(
            trust.run(RECOMMEND_TRIGGER, { priorState, history: priorHistory, overrides: { ...ov, location: null } }),
            deps.timeoutMs,
          )
          if (hasCols(wide)) {
            const place = profile.district.replace(/\b\w/g, (c) => c.toUpperCase())
            note = `I couldn't find colleges specifically in ${place} for your profile, so here are strong options across Tamil Nadu:\n\n`
            retry = wide
          }
        }
        if (hasCols(retry)) advised = { ...retry, response: { ...retry.response, answer: note + retry.response.answer } }
      }
    } catch (e) {
      const code: ChatErrorCode = e instanceof TimeoutError ? 'timeout' : 'internal_error'
      deps.logger.log({ event: 'error', conversationId: id, code, latencyMs: deps.clock() - startedAt, httpStatus: HTTP_STATUS[code] })
      return errorOutcome(code, id)
    }
    const latencyMs = deps.clock() - startedAt

    // Still no answer for a COMPLETE profile. Two very different situations, and conflating
    // them is what produced the "confidently wrong" bug:
    //
    //   • The parent asked something the OFFICIAL DATASET DOES NOT COVER — TNEA deadlines,
    //     documents, counselling rounds, branch-change rules. Say so honestly. Never guess,
    //     and never substitute a college recommendation for an answer.
    //   • The message was simply vague/unparseable ("???", "hmm"). Re-orient to what we CAN
    //     do — but never ask for details they already gave.
    if (profile && isComplete(profile) && advised.response.strategy === 'insufficient_evidence') {
      const unsupported = !RECOMMENDATION_ASK_RE.test(message) && UNSUPPORTED_TOPIC_RE.test(message)
      if (unsupported) {
        declined = true
        analytics.track({ type: 'honest_limitation', conversationId: id, topic: 'unsupported_topic' })
      }
      const where = profile.district ? ` in ${profile.district}` : ''
      // No URL is named on purpose: the portal address is a fact, and inventing or
      // half-remembering one would be exactly the fabrication this system exists to prevent.
      const decline =
        "I don't have that one. TNEA process details — deadlines, application steps, documents, " +
        'counselling rounds, branch-change rules — are not in the official college dataset I work ' +
        "from, so I won't guess at them. Please check the official TNEA counselling portal or your " +
        'counselling centre for those.\n\n' +
        'What I can do with your profile: show the colleges you can realistically get, compare any ' +
        'two of them, or go deeper on placements, cutoffs and rankings.'
      const reorient =
        `I have your details saved (cutoff, community, district and branch). Ask me "which colleges can I get?", to compare two colleges, or about placements — and if you'd like more options${where ? ` beyond${where}` : ''}, say "anywhere in Tamil Nadu" to widen the search and I'll pull them from the data.`
      advised = {
        ...advised,
        response: { ...advised.response, answer: unsupported ? decline : reorient },
      }
    }

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
    // Observability: the Trust Pipeline outcome (strategy, confidence LEVEL, fallback usage,
    // evidence count) — no facts, no message, no cutoff value.
    analytics.track({
      type: 'trust_outcome',
      conversationId: id,
      strategy: advised.response.strategy,
      confidence: advised.response.confidence,
      usedModel: advised.response.usedModel,
      fallback: !advised.response.usedModel,
      evidenceCount: advised.response.evidence.length,
      // Trust observability: WHY the prose was discarded, and whether the hallucination
      // guard silently repaired an answer that still shipped (usedModel stays true for a
      // 'repaired' turn — the case that was previously invisible on live traffic).
      llmStatus: advised.response.llmStatus,
      discardReasons: advised.response.discardReasons,
      repairedSentenceCount: advised.response.repairedSentenceCount,
    })

    const body: ChatResponse = {
      answer: [declined ? null : intro, advised.response.answer, declined ? null : outro]
        .filter((s): s is string => !!s)
        .join('\n\n'),
      citations: advised.response.evidence,
      confidence: advised.response.confidence,
      followUps: advised.response.followUps,
      conversationId: id,
      // This path always ANSWERS (collection uses the separate collectSlot/finish path),
      // so the stage is 'ready' even for a knowledge/comparison answer with no profile.
      ...(profile ? { profile: toView(profile), stage: 'ready' as const } : {}),
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
    if (!conversationId) analytics.track({ type: 'conversation_started', conversationId: id })

    // 3a. No profile store → answer immediately (original behavior; existing callers).
    if (!deps.profileStore) return answer(message, id, priorState, priorHistory, undefined)

    // 3b. Conversational profile layer: collect the profile, then answer using it.
    const priorProfile = (conversationId ? await deps.profileStore.get(conversationId) : undefined) ?? emptyProfile()
    const parsedRaw = trust.parse(message)

    // ── Conversational memory: resolve "it" / "the top two you just mentioned" ──────────
    // The reference is resolved by REWRITING the message with the remembered CANONICAL name
    // (read off the persisted ConversationState), so the parser re-resolves it by exact match.
    // The pronoun itself is never handed to the fuzzy matcher — that is what keeps the
    // phantom-college guard intact. With nothing remembered there is no rewrite, and the
    // counsellor asks which college, exactly as before.
    const resolved = resolveReference(message, parsedRaw, readMemory(priorState))
    const text = resolved ?? message
    const parsed = resolved ? trust.parse(resolved) : parsedRaw

    // Domain / unknown-entity guards apply at ANY stage — decline immediately rather
    // than collecting a profile for a query the warehouse cannot serve.
    if (parsed.outOfDomain !== null || parsed.unverifiedCollege) {
      analytics.track({ type: 'honest_limitation', conversationId: id, topic: parsed.outOfDomain !== null ? 'out_of_domain' : 'unverified_college' })
      return answer(text, id, priorState, priorHistory, priorProfile)
    }

    const wasComplete = isComplete(priorProfile)
    // A message is a QUESTION when it ends with "?", uses a question keyword, OR is an
    // inverted question ("Does PSG have…", "Is CIT good?"). The inversion/"?" checks use
    // the RAW message because the parser's normalizer strips "?" — without them a
    // "Does X have hostels?" is mis-read as a statement and mutates the profile.
    const hasQuestion =
      message.includes('?') ||
      QUESTION_RE.test(parsed.normalized) ||
      /^(is|are|does|do|did|has|have|can|could|will|would|should)\b/i.test(message.trim())
    // Profile protection: once the profile is complete, a QUESTION never mutates it —
    // EXCEPT when it carries explicit change-intent ("switch to ECE", "actually my
    // cutoff is 187", "Chennai instead"), which must update the slot AND be remembered
    // (#5). A bare question ("is CIT good?") leaves the profile intact. During
    // collection every message is merged so the slots fill.
    const explicitChange = CHANGE_RE.test(message)
    // The profile is merged from what the USER actually typed (`message`/`parsedRaw`), never
    // from the memory-resolved text: a substituted name like "Coimbatore Institute of
    // Technology" carries a district token, and merging it would silently set a district the
    // parent never asked for. Memory answers the question; it must not rewrite the student.
    let profile =
      wasComplete && hasQuestion && !explicitChange ? priorProfile : mergeMessage(priorProfile, parsedRaw, message)
    // Normalize a typed district to a known one, tolerating misspellings ("coimbaore"
    // → "coimbatore"), so the district filter matches instead of returning nothing.
    if (deps.resolveDistrict && profile.district) {
      const canonical = deps.resolveDistrict(profile.district)
      if (canonical && canonical !== profile.district) profile = { ...profile, district: canonical }
    }
    await deps.profileStore.set(id, profile)

    const finish = (text: string, stage: 'collecting' | 'ready'): ChatOutcome => {
      rememberTurn(id, message, text)
      deps.logger.log({ event: 'response', conversationId: id, httpStatus: 200, llmStatus: 'profile' })
      return {
        httpStatus: 200,
        body: { answer: text, citations: [], confidence: 'low', followUps: [], conversationId: id, profile: toView(profile), stage },
      }
    }

    // Parent mode (#4): a reassuring tone when a parent is talking, in this message or
    // earlier in the conversation. Used only when composing an answer intro below.
    const isParent = PARENT_RE.test(message) || priorHistory.some((t) => t.role === 'user' && PARENT_RE.test(t.content))
    // The stored profile drives every answer below — echo it so the student sees their
    // onboarding details are being used and never has to repeat them (V2).
    const echo = profileEcho(profile)

    // ── Orchestration Brain: select the route for this turn (decide, don't execute) ──
    // ROUTE on what the user SAID; ANSWER with what they MEANT. The brain's matchers read the
    // raw message, so they must never see the substituted name: injecting "… College of
    // Technology" into "is it realistic for him?" would trip the tier matcher (TIER_WORD
    // "realistic" + TIER_NOUN "colleg") and re-route the turn to a profile prompt. The RESOLVED
    // colleges still reach it via `parsed`, which is what the routing actually needs.
    const decision = decideTurn({ message, parsed, priorProfile, profile, wasComplete, hasQuestion })

    // Product analytics for this turn (privacy-safe: kinds/enums/public college names only).
    for (const ev of turnAnalyticsEvents({
      conversationId: id,
      decision,
      isParent,
      colleges: parsed.colleges,
      hasMultipleColleges: parsed.hasMultipleColleges,
      priorTurns: priorState?.turnCount ?? 0,
      isCloser: isClosingMessage(message),
    })) {
      analytics.track(ev)
    }

    // ── Capability Registry: resolve the decision to a capability and execute it ──
    // The registry is the single dispatch layer. The coordinator provides the execution
    // primitives (reasoning via `answer`, deterministic replies via `finish`, and the
    // exclusion side-effect) — the registry and its handlers own none of them.
    const capabilityContext: CapabilityContext = {
      message: text,
      profile,
      priorProfile,
      echo,
      isParent,
      finish,
      answer: (m, p, intro, outro) => answer(m, id, priorState, priorHistory, p, intro, outro),
      recordExclusion: async (colleges) => {
        const set = excluded.get(id) ?? new Set<string>()
        colleges.forEach((c) => set.add(c.toLowerCase()))
        excluded.set(id, set)
        await deps.profileStore!.set(id, priorProfile)
      },
      listColleges: (city, count, branch) => {
        const list = deps.listColleges?.(city, count, branch)
        if (list) return finish(list, 'ready')
        // The city resolved for routing but yielded no colleges — honest, not a crash.
        return finish(`I don't have colleges on record for "${city}" in the dataset. Try a nearby district, or ask me to recommend across Tamil Nadu.`, 'ready')
      },
    }
    return registry.dispatch(decision, capabilityContext)
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
  /** Privacy-safe product/observability sink. Defaults to structured-log analytics. */
  readonly analytics?: AnalyticsSink
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

  // The set of districts the warehouse actually knows about — used to fuzzy-match a
  // typed district ("coimbaore" → "coimbatore") so onboarding never stores a district
  // that filters every college out.
  const knownDistricts = new Set<string>()
  for (const college of repos.colleges.list()) {
    const d = repos.colleges.districtOf(college.id)
    if (d) knownDistricts.add(d.toLowerCase())
  }

  // Deterministic directory listing (Bug 2): the SAME engine the recommender uses, filtered to a
  // city and capped at the requested count — presented as a plain numbered list, never a
  // "top recommendation", and never gated on a profile.
  const listEngine = createRecommendationEngine(repos, retrieval, { cutoffs })
  const titleCasePlace = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase())
  const listColleges = (city: string, count: number, branch: string | null): string | null => {
    const opts = { district: city, limit: Math.max(1, Math.min(25, count)) }
    const results = branch ? listEngine.recommendByBranch(branch, opts) : listEngine.recommendBestCollege(opts)
    if (results.length === 0) return null
    const lines = results.map((r, i) => {
      const s = retrieval.placements.getSummary(r.college.id) as
        | { medianSalary: number | null; placementPercentage: number | null }
        | null
      const bits: string[] = []
      if (s?.medianSalary != null) bits.push(`₹${(s.medianSalary / 100000).toFixed(1)}L median`)
      if (s?.placementPercentage != null) bits.push(`${Math.round(s.placementPercentage)}% placed`)
      return `${i + 1}. ${r.college.name}${bits.length ? ` — ${bits.join(', ')}` : ''}`
    })
    const branchNote = branch ? ` for ${branch}` : ''
    const askedNote = count > results.length ? ` (that's all ${results.length} on record${branchNote})` : ''
    return (
      `Here ${lines.length === 1 ? 'is 1 college' : `are ${lines.length} colleges`} in ${titleCasePlace(city)}${branchNote}, ranked by overall strength${askedNote}:\n\n` +
      `${lines.join('\n')}\n\n` +
      `Ask me to compare any two, or tell me your cutoff and community and I'll flag which you can realistically get.`
    )
  }

  return createCounselorChatService({
    opinion,
    // Persist the canonical ConversationState in Supabase when configured, so multi-turn
    // continuity survives across Container App replicas / cold-starts. Degrades to
    // in-memory automatically when Supabase isn't configured (tests/local) — same pattern
    // as the profile store below.
    sessionStore: options.sessionStore ?? createConfiguredSessionStore(env) ?? createInMemorySessionStore(),
    // Persist the profile in Supabase when configured, so onboarding survives across
    // Container App replicas / cold-starts (no more restart loop). Degrades to
    // in-memory automatically when Supabase isn't configured (tests/local).
    profileStore: options.profileStore ?? createConfiguredProfileStore(env) ?? createInMemoryProfileStore(),
    logger: options.logger ?? createConsoleLogger(),
    // Emit privacy-safe product/observability events to structured logs (scraped by ops).
    analytics: options.analytics ?? createConsoleAnalytics(),
    clock: options.clock ?? Date.now,
    idGenerator: options.idGenerator ?? (() => randomUUID()),
    timeoutMs,
    maxMessageLength: options.maxMessageLength,
    resolveDistrict: (input) => resolveDistrict(input, knownDistricts),
    listColleges,
  })
}
