/**
 * @module lib/recommendation
 *
 * Public API of the Recommendation Engine (Sprint 3). Sits ABOVE the Sprint 2
 * Structured Retrieval Engine and the Phase 1 Canonical Knowledge Warehouse. It
 * is the deterministic decision layer — scoring, eligibility banding, strategy
 * ranking, structured reasoning, and comparison. Contains NO AI, LLM, embeddings,
 * vector search, RAG, chatbot, or prompts: the engine DECIDES; a future LLM only
 * EXPLAINS the structured output.
 *
 * Typical usage:
 *   const warehouse  = buildWarehouse(sources)            // @/lib/knowledge
 *   const repos      = createRepositories(warehouse)      // @/lib/knowledge
 *   const retrieval  = createRetrievalEngine(repos)       // @/lib/retrieval
 *   const engine     = createRecommendationEngine(repos, retrieval)
 *   engine.recommendBestPlacement({ limit: 5 })
 *   engine.compareColleges(['PSG College of Technology', 'Thiagarajar College of Engineering'])
 */

// ── Configuration (Module 8) ─────────────────────────────────────────────────
export {
  type DimensionWeights,
  type NormalizationRefs,
  type EligibilityThresholds,
  type ConfidenceConfig,
  type ReasonThresholds,
  type RecommendationConfig,
  type DeepPartial,
  defaultConfig,
  resolveConfig,
} from './config'

// ── Models / DTOs (Module 1) ─────────────────────────────────────────────────
export * from './models'

// ── Data / profile layer ─────────────────────────────────────────────────────
export {
  classifyInstituteType,
  type CutoffLookup,
  type CutoffQuery,
  nullCutoffLookup,
  createTableCutoffLookup,
  type ProfileProvider,
  createProfileProvider,
} from './data'

// ── Scoring (Module 2) ───────────────────────────────────────────────────────
export {
  type RawDimension,
  clamp01,
  ratio,
  normalizeToRef,
  blend,
  EXTRACTORS,
  type ScoringEngine,
  createScoringEngine,
} from './scoring'

// ── Eligibility (Module 3) ───────────────────────────────────────────────────
export {
  type EligibilityEngine,
  type EligibilityInput,
  createEligibilityEngine,
} from './eligibility'

// ── Reasons (Module 6) ───────────────────────────────────────────────────────
export {
  DIMENSION_LABEL,
  DIMENSION_SUMMARY,
  CATEGORY_HEADLINE,
  evidenceFor,
  type ReasonGenerator,
  createReasonGenerator,
} from './reasons'

// ── Strategies (Module 4) ────────────────────────────────────────────────────
export {
  type StrategyContext,
  type RankSpec,
  rankProfiles,
  type Strategy,
  STRATEGIES,
  strategyFor,
} from './strategies'

// ── Comparison (Module 5) ────────────────────────────────────────────────────
export {
  type ComparisonEngine,
  type ComparisonDeps,
  createComparisonEngine,
} from './comparison'

// ── Facade (Module 7) ────────────────────────────────────────────────────────
export {
  type RecommendationEngine,
  type RecommendationEngineOptions,
  type RecommendationOptions,
  createRecommendationEngine,
} from './facade'
