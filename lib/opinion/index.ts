/**
 * @module lib/opinion
 *
 * Public API of the AI Opinion & Recommendation Engine (Sprint 8). It sits ON TOP
 * of the existing pipeline — reusing the Sprint 2 retrieval, Sprint 3
 * recommendation, Sprint 4 orchestration, and Sprint 5 LLM adapter — and turns
 * their deterministic output into grounded, counselor-grade OPINIONS
 * (recommendation + reasoning + evidence ids + confidence + trade-offs + risks).
 * It never invents facts, never calls a provider directly, and never modifies an
 * earlier sprint. With no provider wired it returns a fully-grounded deterministic
 * answer; the LLM only phrases what the engine already decided.
 *
 * Usage:
 *   const repos     = createRepositories(buildWarehouse(sources)) // @/lib/knowledge
 *   const retrieval = createRetrievalEngine(repos)                // @/lib/retrieval
 *   const opinion   = createOpinionService(repos, retrieval, { cutoffs?, provider? })
 *   const { response } = await opinion.advise('I scored 182. Which colleges should I choose?')
 */

// ── Configuration ────────────────────────────────────────────────────────────
export {
  type OpinionConfig,
  defaultOpinionConfig,
  resolveOpinionConfig,
  SUBSTANTIVE_DIMENSIONS,
} from './config'

// ── Models / DTOs (Module 6) ─────────────────────────────────────────────────
export * from './models'

// ── Module 1: Context Builder ────────────────────────────────────────────────
export { type OpinionContextDeps, buildOpinionContext } from './context/opinion-context-builder'

// ── Module 2: Strategy ───────────────────────────────────────────────────────
export { type StrategySelection, selectStrategy } from './strategy/opinion-strategy'

// ── Module 3: Generator ──────────────────────────────────────────────────────
export { generateOpinions } from './generator/opinion-generator'

// ── Module 4: Prompt Builder ─────────────────────────────────────────────────
export { buildOpinionPrompt } from './prompt/opinion-prompt-builder'

// ── Module 5: Validator ──────────────────────────────────────────────────────
export { type OpinionValidation, validateOpinionResponse } from './validator/opinion-validator'

// ── Module 6: Formatter ──────────────────────────────────────────────────────
export { formatOpinion } from './formatter/opinion-formatter'

// ── Engine facade ────────────────────────────────────────────────────────────
export { type OpinionEngine, type PreparedOpinion, createOpinionEngine } from './engine/opinion-engine'

// ── Module 7: Service integration ────────────────────────────────────────────
export {
  type OpinionService,
  type OpinionServiceOptions,
  type AdviceResult,
  createOpinionService,
} from './service/opinion-service'
