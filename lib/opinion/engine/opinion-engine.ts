/**
 * @module lib/opinion/engine/opinion-engine
 *
 * The Opinion Engine facade — composes the six modules. `prepare()` runs the
 * DETERMINISTIC pipeline (strategy → context → generator → prompt); `complete()`
 * runs the post-LLM pipeline (validate → format). Splitting them lets the service
 * make the LLM call in between while keeping the engine free of any provider
 * concern. No AI.
 */

import type { RecommendationEngine } from '@/lib/recommendation'
import {
  createEvidenceCollector,
  defaultOrchestrationConfig,
  type ContextPackage,
  type FollowUpQuestion,
  type ParsedQuery,
  type PromptPackage,
} from '@/lib/ai/orchestration'
import type { LLMResult } from '@/lib/ai/llm'
import { resolveOpinionConfig, type OpinionConfig } from '../config'
import type { OpinionStrategy } from '../models'
import { buildOpinionContext } from '../context/opinion-context-builder'
import { generateOpinions } from '../generator/opinion-generator'
import { buildOpinionPrompt } from '../prompt/opinion-prompt-builder'
import { selectStrategy } from '../strategy/opinion-strategy'
import { validateOpinionResponse } from '../validator/opinion-validator'
import { formatOpinion } from '../formatter/opinion-formatter'
import type { OpinionContext, OpinionOptions, OpinionResponse, OpinionResult } from '../models'

/** The deterministic output ready for the LLM. */
export interface PreparedOpinion {
  readonly opinionContext: OpinionContext
  readonly result: OpinionResult
  readonly prompt: PromptPackage
  /**
   * The Sprint-4 context the prompt's evidence was drawn from — possibly enriched
   * with a fallback quality baseline. The LLM adapter MUST ground on THIS (not the
   * original orchestration context) so a valid model citation validates.
   */
  readonly groundingContext: ContextPackage
}

/** The Opinion Engine. */
export interface OpinionEngine {
  readonly config: OpinionConfig
  /** Deterministic: strategy → dossiers → recommendations → prompt. */
  prepare(parsed: ParsedQuery, context: ContextPackage, options?: OpinionOptions): PreparedOpinion
  /** Post-LLM: validate the model answer, then format the response contract. */
  complete(prepared: PreparedOpinion, followUps: readonly FollowUpQuestion[], llm: LLMResult): OpinionResponse
}

/**
 * Recommendation-seeking strategies that warrant a quality-baseline fallback when
 * the orchestration produced no candidates (e.g. eligibility blocked by a missing
 * community). NOT `general_counseling`/`comparison` — an unrecognized or purely
 * informational query must NOT trigger a college dump; it degrades to insufficient.
 */
const RECOMMEND_FALLBACK: ReadonlySet<OpinionStrategy> = new Set<OpinionStrategy>([
  'college_recommendation',
  'eligibility_bands',
  'branch_recommendation',
  'placement_focused',
  'research_focused',
  'faculty_focused',
  'budget_focused',
])

/** Create the Opinion Engine over the reused Sprint 3 recommendation engine. */
export function createOpinionEngine(deps: {
  readonly reco: RecommendationEngine
  readonly config?: Partial<OpinionConfig>
}): OpinionEngine {
  const config = resolveOpinionConfig(deps.config)
  const evidenceCollector = createEvidenceCollector(defaultOrchestrationConfig)

  const prepare = (parsed: ParsedQuery, baseContext: ContextPackage, options?: OpinionOptions): PreparedOpinion => {
    const selection = selectStrategy(parsed, options?.priorities)

    // Graceful fallback: when the primary orchestration produced no candidates for
    // a recommendation intent (e.g. eligibility blocked by a missing community),
    // fall back to a grounded overall-quality ranking + its evidence — so we can
    // still counsel by quality with an explicit eligibility caveat, never invent.
    let context = baseContext
    if (
      RECOMMEND_FALLBACK.has(selection.strategy) &&
      baseContext.recommendations.length === 0 &&
      baseContext.comparison === null &&
      baseContext.subjects.length === 0
    ) {
      // Respect the requested district (RC2) even on the quality-baseline fallback,
      // so an out-of-district college is never surfaced.
      const recommendations = deps.reco.recommendBestCollege({
        limit: config.candidateLimit,
        district: parsed.location ?? undefined,
      })
      const evidence = evidenceCollector.collect({ recommendations, comparison: null, facts: [] })
      context = { ...baseContext, recommendations, evidence }
    }

    const opinionContext = buildOpinionContext(
      { profiles: deps.reco.profiles, config },
      {
        parsed: { studentCutoff: parsed.studentCutoff, community: parsed.community, branch: parsed.branch },
        context,
        strategy: selection.strategy,
        priorities: selection.priorities,
      },
    )
    const result = generateOpinions(opinionContext, config)
    const prompt = buildOpinionPrompt({
      question: parsed.raw,
      context: opinionContext,
      result,
      history: options?.history ?? [],
      systemPrompt: options?.systemPrompt,
    })
    return { opinionContext, result, prompt, groundingContext: context }
  }

  const complete = (
    prepared: PreparedOpinion,
    followUps: readonly FollowUpQuestion[],
    llm: LLMResult,
  ): OpinionResponse => {
    const validation = validateOpinionResponse(llm, prepared.result, prepared.opinionContext)
    return formatOpinion({
      result: prepared.result,
      context: prepared.opinionContext,
      followUps,
      llm,
      validation,
    })
  }

  return Object.freeze({ config, prepare, complete })
}
