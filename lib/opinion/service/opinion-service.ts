/**
 * @module lib/opinion/service/opinion-service
 *
 * Integration (Module 7). Wires the deterministic pipeline into the EXISTING
 * orchestration without modifying it:
 *
 *   Retriever + Recommendation (Sprint 4 orchestrator, reused)
 *      → Opinion Engine (Sprint 8)
 *      → LLM Adapter (Sprint 5, reused)
 *      → Opinion Validator + Formatter (Sprint 8)
 *      → Chat Response
 *
 * It never bypasses the retriever/recommendation engines, never calls a provider
 * directly (only through the injected Sprint-5 adapter), and never modifies any
 * earlier sprint. With no provider wired it degrades to a fully-grounded,
 * deterministic counselor answer. No AI in this module.
 */

import type { KnowledgeRepositories } from '@/lib/knowledge'
import type { RetrievalEngine } from '@/lib/retrieval'
import type { CutoffLookup } from '@/lib/recommendation'
import {
  createAIOrchestrator,
  type ConfidenceLevel,
  type ConversationState,
  type ParsedQuery,
} from '@/lib/ai/orchestration'
import { createLLMAdapter, createUnavailableProvider, type LLMAdapter, type LLMProvider } from '@/lib/ai/llm'
import type { OpinionConfig } from '../config'
import { createOpinionEngine, type OpinionEngine } from '../engine/opinion-engine'
import type { OpinionOptions, OpinionResponse } from '../models'

/** Options for constructing the opinion service. */
export interface OpinionServiceOptions {
  readonly config?: Partial<OpinionConfig>
  /** Historical-cutoff source enabling safe/moderate/dream banding (Sprint 3). */
  readonly cutoffs?: CutoffLookup
  /** A pre-built Sprint-5 LLM adapter. */
  readonly adapter?: LLMAdapter
  /** Or a Sprint-5 provider to build one from (defaults to unavailable → deterministic). */
  readonly provider?: LLMProvider
  /** Optional counselor system-prompt override applied to every turn. */
  readonly systemPrompt?: string
}

/** One turn's result. */
export interface AdviceResult {
  readonly response: OpinionResponse
  readonly state: ConversationState
}

/** The counselor-grade opinion service. */
export interface OpinionService {
  readonly engine: OpinionEngine
  /** Deterministic query understanding only (no recommendation/LLM) — for slot-filling. */
  parse(question: string): ParsedQuery
  advise(question: string, options?: OpinionOptions & { priorState?: ConversationState }): Promise<AdviceResult>
}

/** The fixed scope decline for out-of-domain (non-engineering) queries (RC6). */
const OUT_OF_DOMAIN_RESPONSE: OpinionResponse = {
  answer: 'I currently only support Tamil Nadu Engineering counselling.',
  evidence: [],
  confidence: 'low',
  followUps: [],
  recommendationSummary: [],
  strategy: 'general_counseling',
  usedModel: false,
}

/** The fixed decline for a named-but-unverifiable college (RC7). */
const UNVERIFIED_COLLEGE_RESPONSE: OpinionResponse = {
  answer: "I couldn't verify that college from the official warehouse.",
  evidence: [],
  confidence: 'low',
  followUps: [],
  recommendationSummary: [],
  strategy: 'general_counseling',
  usedModel: false,
}

/**
 * Confidence (RC5): HIGH only when the answer is well-constrained AND warehouse-
 * grounded — a clear intent, a matched district, and verified eligibility (cutoff +
 * community supplied, so the eligibility filter ran), with cited evidence and real
 * recommendations. Otherwise medium (grounded but generic) or low. This decouples
 * confidence from mere data completeness, so it tracks the ANSWER's quality.
 */
function deriveConfidence(parsed: ParsedQuery, response: OpinionResponse): ConfidenceLevel {
  const hasRecs = response.recommendationSummary.some((s) => s.colleges.length > 0)
  const grounded = response.evidence.length > 0
  if (!hasRecs || !grounded) return 'low'
  // "understood" = a clear intent OR strong parsed entities — a constraint-only query
  // like "Mechanical in Salem SC 180" is understood even if no intent keyword scored.
  const understood =
    (parsed.intent !== 'unknown' && parsed.intentConfidence >= 0.5) ||
    parsed.branch !== null ||
    parsed.studentCutoff !== null ||
    parsed.location !== null
  const districtMatched = parsed.location !== null // the engine guarantees in-district recs
  const eligibilityVerified = parsed.studentCutoff !== null && parsed.community !== null
  if (understood && districtMatched && eligibilityVerified) return 'high'
  return understood ? 'medium' : 'low'
}

/**
 * An honest, one-line explanation of WHY the confidence is what it is — the data that
 * backs the recommendation vs. what the official dataset simply does not carry (#7).
 * Never fabricated: it reflects exactly which evidence was present.
 */
function confidenceRationale(parsed: ParsedQuery, response: OpinionResponse, level: ConfidenceLevel): string {
  const have: string[] = []
  const missing: string[] = []
  if (parsed.studentCutoff !== null && parsed.community !== null) {
    have.push('your community closing-cutoff (so I could check eligibility)')
  } else {
    missing.push('your cutoff and community to confirm eligibility')
  }
  if (response.evidence.some((e) => /salary|placement/i.test(e.label))) have.push('placement and salary figures')
  else missing.push('placement figures for these colleges')
  missing.push('fee, hostel, recruiter and branch-level cutoff data (not in the official dataset)')

  const lead =
    level === 'high' ? "I'm fairly confident here" : level === 'medium' ? "I'm moderately confident" : "I'm not fully confident yet"
  const haveStr = have.length > 0 ? ` — I have ${have.join(' and ')}` : ''
  const missStr = missing.length > 0 ? `. I don't have ${missing.join('; ')}, so weigh those separately.` : '.'
  return `Confidence: ${lead}${haveStr}${missStr}`
}

/** Create the opinion service over Phase-1 repositories + the retrieval engine. */
export function createOpinionService(
  repos: KnowledgeRepositories,
  retrieval: RetrievalEngine,
  options: OpinionServiceOptions = {},
): OpinionService {
  const orchestrator = createAIOrchestrator(repos, retrieval, { cutoffs: options.cutoffs })
  const engine = createOpinionEngine({ reco: orchestrator.reco, config: options.config })
  const adapter =
    options.adapter ?? createLLMAdapter(options.provider ?? createUnavailableProvider('none', 'no provider configured'))

  const advise = async (
    question: string,
    o?: OpinionOptions & { priorState?: ConversationState },
  ): Promise<AdviceResult> => {
    // 1. Reuse the Sprint-4 orchestrator (Retriever + Recommendation + Context).
    const orchestration = orchestrator.orchestrate(question, o?.priorState, o?.overrides)
    // Domain guard (RC6): the warehouse only covers TN engineering — decline any
    // other domain (medical/law/arts/…) instead of returning an engineering college.
    if (orchestration.parsed.outOfDomain !== null) {
      return { response: OUT_OF_DOMAIN_RESPONSE, state: orchestration.state }
    }
    // Unknown-entity guard (RC7): a named college we could not verify → decline
    // rather than fuzzy-matching to an arbitrary real college.
    if (orchestration.parsed.unverifiedCollege) {
      return { response: UNVERIFIED_COLLEGE_RESPONSE, state: orchestration.state }
    }
    // 2. Deterministic opinion (strategy → dossiers → recommendations → prompt).
    const prepared = engine.prepare(orchestration.parsed, orchestration.context, {
      priorities: o?.priorities,
      history: o?.history,
      limit: o?.limit,
      systemPrompt: o?.systemPrompt ?? options.systemPrompt,
    })
    // 3. LLM via the reused Sprint-5 adapter, grounded on the SAME context the
    //    prompt was built from (may be a fallback-enriched baseline).
    const llm = await adapter.respond(prepared.prompt, prepared.groundingContext)
    // 4. Validate + format (deterministic fallback if the model is unusable).
    const response = engine.complete(prepared, orchestration.context.followUpQuestions, llm)
    // Confidence (RC5): reflect the ANSWER's quality, not just data completeness.
    const confidence = deriveConfidence(orchestration.parsed, response)
    // On the DETERMINISTIC path, append an honest confidence explanation (#7). When the
    // model answered, it explains its own confidence per the counselor system prompt.
    const hasRecs = response.recommendationSummary.some((s) => s.colleges.length > 0)
    const answer =
      !response.usedModel && hasRecs
        ? `${response.answer}\n\n${confidenceRationale(orchestration.parsed, response, confidence)}`
        : response.answer
    return { response: { ...response, answer, confidence }, state: orchestration.state }
  }

  return Object.freeze({ engine, parse: (q) => orchestrator.parse(q), advise })
}
