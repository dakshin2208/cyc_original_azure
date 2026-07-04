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
import { createAIOrchestrator, type ConversationState } from '@/lib/ai/orchestration'
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
    const orchestration = orchestrator.orchestrate(question, o?.priorState)
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
    return { response, state: orchestration.state }
  }

  return Object.freeze({ engine, advise })
}
