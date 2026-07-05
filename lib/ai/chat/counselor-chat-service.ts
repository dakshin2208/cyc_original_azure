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
import type { ConversationState, ParsedQuery } from '@/lib/ai/orchestration'
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
  createConfiguredProfileStore,
  createInMemoryProfileStore,
  emptyProfile,
  isComplete,
  mergeMessage,
  nextMissingSlot,
  onboardingSummary,
  PROFILE_SLOTS,
  profileEcho,
  profilesEqual,
  resolveDistrict,
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
  /**
   * Normalize a typed district to a known one, tolerating misspellings
   * ("coimbaore" → "coimbatore"). Returns null when nothing is close enough (the
   * service then broadens the recommendation statewide). Absent → no normalization.
   */
  readonly resolveDistrict?: (input: string) => string | null
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

/** Warm first-contact greeting (shown once, before the first slot prompt) — V2. */
const WELCOME =
  "👋 Welcome to ChooseYourCollege AI Counselor.\n\nI'll help you find the best engineering colleges based on your profile.\n\nLet's first understand your preferences."
/** Recommendation query used to counsel the moment the profile is complete/updated. */
const RECOMMEND_TRIGGER = 'recommend the best colleges for me'
/** A parent (rather than the student) is talking — switch to a reassuring tone. */
const PARENT_RE = /\bmy (son|daughter|child|kid|ward|boy|girl)\b|\bour (son|daughter|child|kid)\b|\bfor my\b|\bwe are (planning|looking)\b/i

// ── Refinement (#5): once the profile is complete, a follow-up can re-scope the
// SAME student without restarting — by college type ("government only"), by safety
// ("safer backups"), or by changing a slot in place ("switch to ECE", "actually
// 187"). Each maps to a CLEAN engine trigger; the raw wording (e.g. the word "safe",
// which the parser would mistake for a college name) never reaches the parser.
const CHANGE_RE =
  /\b(instead|actually|switch(?:ing)? to|change (?:it |that |my )?to|change my|make it|rather|no,? i (want|meant)|i meant|update (?:my|to))\b/i
const GOVT_RE = /\bgovern(?:ment|ance)?\b|\bgovt\b|\baided\b/i
const PRIVATE_RE = /\bprivate\b|\bself[ -]?financ\w*\b|\bdeemed\b/i
const SAFER_RE = /\bsafe(?:r|st)?\b|\bbackup(?:s)?\b|\bsure[ -]?shot\b|\bguaranteed\b|\bwithin reach\b|\blow[ -]?risk\b/i
const REMOVE_RE =
  /\b(remove|exclude|drop|without|don'?t (?:want|like|show)|not interested in|take out|leave out|skip|get rid of)\b/i
const COMPARE_RE = /\b(compare|comparison|versus|difference between|better between)\b|\bvs\.?\b/i
// A pure social / acknowledgement message — the ONLY complete-profile input that should
// NOT produce a recommendation. Everything else is treated as a counselling question.
const SOCIAL_RE = /^(ok(ay)?|k|thanks?|thank you|thx|cool|nice|great|good|got ?it|fine|hmm+|hi+|hello|hey|yo|bye|done|sure|yes|yeah|yep|no|nope|👍|🙏)[\s!.]*$/i
// Eligibility ("will he get a seat?", "chances?", "can she get admission?") — matches
// first- AND third-person, since a parent asks on the student's behalf. Routed to the
// safe/target/reach band view so a complete profile is never told "share your cutoff".
const ELIGIBILITY_RE =
  /\b(will|can|could|would|does|do)\s+(i|he|she|they|we|my (son|daughter|child|kid|ward))\s+(get|join|make it|get in|get into|qualify)\b|\b(get|getting)\s+(a\s+)?(seat|admission)\b|\bchances?\b|\bdefinitely get\b|\beligib\w*\b|\bqualify\b|\bsafe seat\b/i
const FEE_RE = /\b(cheap(?:er|est)?|afford\w*|budget|low(?:er)?[ -]?fees?|fees?|tuition|scholarships?|cost\w*)\b/i
const HOSTEL_RE = /\b(hostel|accommodation|mess|campus life|dining|food|canteen)\b/i
// Recruiter NAMES aren't in the dataset (placement RATE and median salary ARE) — so
// "which companies recruit" is honestly declined, while "placements"/"salary" is answered.
const RECRUITER_RE = /\brecruit\w*\b|\b(which|what|name|list|top)\b[^.?]{0,24}\bcompan\w*|\bfirms?\b|\bplacement partners?\b/i

/**
 * A complete-profile message that RE-SCOPES the search to a college TYPE or a
 * SAFETY view — returns a clean engine trigger + a natural intro. Returns null when
 * the message names a specific college (so comparisons and college-specific
 * questions are never hijacked) or isn't a scope refinement. The stored profile
 * still carries cutoff/community/district/branch; only the college SET changes.
 */
function refinementTrigger(message: string, parsed: ParsedQuery): { trigger: string; intro: string } | null {
  if (parsed.colleges.length > 0) return null // a named college → a question, not a re-scope
  if (GOVT_RE.test(message)) {
    return { trigger: 'recommend the best government colleges for me', intro: 'Sure — here are the government options for your rank and district:' }
  }
  if (PRIVATE_RE.test(message)) {
    return { trigger: 'recommend the best private colleges for me', intro: 'Here are the private options that fit your profile:' }
  }
  if (SAFER_RE.test(message)) {
    return { trigger: 'which colleges can I safely get into', intro: "Let's look at how realistic each seat is for your rank — safest bets first:" }
  }
  if (ELIGIBILITY_RE.test(message)) {
    return { trigger: 'which colleges can I safely get into', intro: "Here's how realistic each option is for that rank — the safe bets first, then the stretches:" }
  }
  // Stated PRIORITY (#3 → thread to the engine): a preference like "I care most about
  // placements" re-ranks by that dimension via the matching engine strategy. "recruit"
  // is deliberately excluded here so "which companies recruit" gets the honest
  // recruiter-names decline instead.
  if (/\b(placement|placements|job|jobs|package|salary|highest paying)\b/i.test(message)) {
    return { trigger: 'which colleges have the best placements', intro: 'Since placements matter most to you, here they are ranked by placement strength:' }
  }
  if (/\b(roi|return on invest|value for money|worth it)\b/i.test(message)) {
    return { trigger: 'best return on investment colleges', intro: 'Ranking these by return on investment:' }
  }
  if (/\b(research|innovation|higher studies|for ms|do ms|phd)\b/i.test(message)) {
    return { trigger: 'colleges with the best research', intro: 'Ranking by research strength:' }
  }
  if (/\b(reputation|brand|prestige|well[ -]?known|nirf|overall ranking)\b/i.test(message)) {
    return { trigger: 'the best overall colleges', intro: 'Ranking by overall reputation:' }
  }
  return null
}

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
    let advised: { response: import('@/lib/opinion').OpinionResponse; state: ConversationState }
    try {
      const exSet = excluded.get(id)
      const exclude = exSet && exSet.size > 0 ? [...exSet] : undefined
      const overrides = profile ? { ...toOverrides(profile), exclude } : exclude ? { exclude } : undefined
      advised = await withTimeout(
        deps.opinion.advise(message, { priorState, history: priorHistory, overrides }),
        deps.timeoutMs,
      )
      // Guarantee colleges: a complete profile must never get a "no evidence" deflection.
      // The raw phrasing may not parse to a recommendation intent ("tell me the collage
      // what i get"), so retry with a RELIABLE recommendation query; and if the DISTRICT
      // still matches nothing, broaden across Tamil Nadu.
      const hasCols = (a: typeof advised): boolean =>
        a.response.recommendationSummary.some((s) => s.colleges.length > 0)
      if (profile && isComplete(profile) && advised.response.strategy === 'insufficient_evidence') {
        const ov = { ...toOverrides(profile), exclude }
        let retry = await withTimeout(
          deps.opinion.advise(RECOMMEND_TRIGGER, { priorState, history: priorHistory, overrides: ov }),
          deps.timeoutMs,
        )
        let note = ''
        if (!hasCols(retry) && profile.district) {
          const wide = await withTimeout(
            deps.opinion.advise(RECOMMEND_TRIGGER, { priorState, history: priorHistory, overrides: { ...ov, location: null } }),
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

    // A COMPLETE profile must never be told "share your cutoff and community" — that
    // happens when a vague/unparseable message ("???", "hmm") yields insufficient
    // evidence. Re-orient to what we CAN do instead of asking for details already given.
    if (profile && isComplete(profile) && advised.response.strategy === 'insufficient_evidence') {
      const where = profile.district ? ` in ${profile.district}` : ''
      advised = {
        ...advised,
        response: {
          ...advised.response,
          answer:
            `I have your details saved (cutoff, community, district and branch). Ask me "which colleges can I get?", to compare two colleges, or about placements — and if you'd like more options${where ? ` beyond${where}` : ''}, say "anywhere in Tamil Nadu" to widen the search and I'll pull them from the data.`,
        },
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

    const body: ChatResponse = {
      answer: [intro, advised.response.answer, outro].filter((s): s is string => !!s).join('\n\n'),
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
    let profile =
      wasComplete && hasQuestion && !explicitChange ? priorProfile : mergeMessage(priorProfile, parsed, message)
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
    // The stored profile drives every answer below — echo it so the student sees their
    // onboarding details are being used and never has to repeat them (V2).
    const echo = profileEcho(profile)

    // Onboarding just completed → confirm the collected profile and INVITE a question.
    // We do NOT auto-answer here (V2): the student asks next, and every answer then uses
    // this stored profile automatically.
    if (!wasComplete) {
      return finish(onboardingSummary(profile), 'ready')
    }
    // Exclusion (#5): "remove / drop / not interested in <college>" — remember it and
    // re-counsel without that college. The profile itself is unchanged (the mention of
    // a college here is a rejection, not a new preference), so we re-store priorProfile.
    if (REMOVE_RE.test(message) && parsed.colleges.length > 0) {
      const set = excluded.get(id) ?? new Set<string>()
      parsed.colleges.forEach((c) => set.add(c.toLowerCase()))
      excluded.set(id, set)
      await deps.profileStore.set(id, priorProfile)
      const intro = `Done — I've taken ${parsed.colleges.join(', ')} off your list. Here's the updated guidance:`
      return answer(RECOMMEND_TRIGGER, id, priorState, priorHistory, priorProfile, intro)
    }
    // An explicit profile change (cutoff/community/district/branch) — including one
    // phrased as a question via change-intent ("switch to ECE") → re-counsel with the
    // updated, remembered profile (#5).
    if (!profilesEqual(priorProfile, profile)) {
      const intro = isParent ? `Understood — I've updated that. Here's my revised guidance for your child:` : `Got it — I've updated that. Here's my revised guidance:`
      return answer(RECOMMEND_TRIGGER, id, priorState, priorHistory, profile, `${echo}\n\n${intro}`)
    }
    // Comparison intent but fewer than two colleges were identified (often an
    // abbreviation the warehouse doesn't carry) — ask for the full name instead of
    // silently recommending the one we DID find.
    if (COMPARE_RE.test(message) && parsed.colleges.length < 2) {
      const found = parsed.colleges[0]
      const msg = found
        ? `I can compare two colleges side by side, but I could only identify ${found} from that. What's the other one's full name? (I sometimes miss abbreviations like "SSN" or "CIT" — the full name works best.)`
        : `Happy to compare two colleges side by side — give me both full names, e.g. "compare PSG College of Technology and Kumaraguru College of Technology".`
      return finish(msg, 'ready')
    }
    // A scope refinement on the SAME student — government/private, a safety view, or a
    // stated priority — re-counsel without restarting; the stored profile is preserved (#5/#3).
    const refine = refinementTrigger(message, parsed)
    if (refine) return answer(refine.trigger, id, priorState, priorHistory, profile, `${echo}\n\n${refine.intro}`)
    // Fees / hostel / recruiter names — honestly absent from the official dataset
    // (whether or not a college is named): say so and steer to what we CAN help with,
    // rather than guessing (#5, honesty). Skipped for a two-college comparison, which
    // has its own head-to-head handling.
    if (!parsed.hasMultipleColleges) {
      const who = parsed.colleges[0] ? `${parsed.colleges[0]}'s ` : ''
      if (FEE_RE.test(message)) {
        return finish(
          `I don't have ${who}tuition-fee data in the official dataset, so I won't guess. Government colleges are generally the most affordable — say "show government colleges" for your rank, and check any specific college's official fee structure.`,
          'ready',
        )
      }
      if (HOSTEL_RE.test(message)) {
        return finish(
          `I don't have ${who}hostel or campus-life details in the official dataset, so I can't compare those reliably. I can still help with placements, cutoffs, eligibility, or comparing two colleges head-to-head.`,
          'ready',
        )
      }
      if (RECRUITER_RE.test(message)) {
        return finish(
          `The official dataset doesn't list ${who ? `${who}specific recruiters` : 'specific recruiter names'} — I have placement rate and median salary, but not the company names. Ask me about ${who ? 'its ' : ''}placements or median package and I'll give you the figures I do have.`,
          'ready',
        )
      }
    }
    // A keyworded follow-up question → answer it directly, using the stored profile.
    if (hasQuestion) return answer(message, id, priorState, priorHistory, profile, echo)
    // A pure social / acknowledgement message ("ok", "thanks", "hi") → a light nudge,
    // no recommendation.
    if (SOCIAL_RE.test(message.trim())) {
      return finish(
        `Happy to help — ask me "which colleges can I get?", to compare two colleges, or about placements, and I'll use your profile.`,
        'ready',
      )
    }
    // ANYTHING ELSE from a student with a complete profile is a counselling request
    // ("give me colleges", "college names", "options for me", …) → ANSWER it as a
    // counsellor with warehouse-grounded recommendations. Never deflect a real ask.
    return answer(RECOMMEND_TRIGGER, id, priorState, priorHistory, profile, echo)
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

  // The set of districts the warehouse actually knows about — used to fuzzy-match a
  // typed district ("coimbaore" → "coimbatore") so onboarding never stores a district
  // that filters every college out.
  const knownDistricts = new Set<string>()
  for (const college of repos.colleges.list()) {
    const d = repos.colleges.districtOf(college.id)
    if (d) knownDistricts.add(d.toLowerCase())
  }

  return createCounselorChatService({
    opinion,
    sessionStore: options.sessionStore ?? createInMemorySessionStore(),
    // Persist the profile in Supabase when configured, so onboarding survives across
    // Container App replicas / cold-starts (no more restart loop). Degrades to
    // in-memory automatically when Supabase isn't configured (tests/local).
    profileStore: options.profileStore ?? createConfiguredProfileStore(env) ?? createInMemoryProfileStore(),
    logger: options.logger ?? createConsoleLogger(),
    clock: options.clock ?? Date.now,
    idGenerator: options.idGenerator ?? (() => randomUUID()),
    timeoutMs,
    maxMessageLength: options.maxMessageLength,
    resolveDistrict: (input) => resolveDistrict(input, knownDistricts),
  })
}
