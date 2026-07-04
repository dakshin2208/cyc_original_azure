/**
 * @module lib/retrieval
 *
 * Public API of the Structured Retrieval Engine (Sprint 2). Sits directly above
 * the Phase 1 Canonical Knowledge Warehouse repositories and provides pure,
 * deterministic retrieval — no AI, LLM, embeddings, or vector search.
 *
 * Usage:
 *   const warehouse = buildWarehouse(sources)         // @/lib/knowledge
 *   const repos     = createRepositories(warehouse)   // @/lib/knowledge
 *   const engine    = createRetrievalEngine(repos)    // @/lib/retrieval
 *   engine.colleges.findByExactName('PSG College of Technology')
 *   engine.search.searchPlacement('kumaraguru')
 */

// ── Engine (composition root) ────────────────────────────────────────────────
export { createRetrievalEngine, type RetrievalEngine } from './engine'

// ── Result DTOs ──────────────────────────────────────────────────────────────
export type {
  MatchType,
  RankedMatch,
  SearchResult,
  TrendPoint,
  PlacementSummary,
  FinanceYear,
  FinanceSummary,
  ResearchSummary,
  FacultySummary,
  InstitutionProfile,
  CollegePlacementView,
  CollegeFinanceView,
  CollegeResearchView,
} from './models'

// ── Ranking primitives ───────────────────────────────────────────────────────
export { levenshtein, similarity, rankCandidates, scoreCandidate, FUZZY_THRESHOLD, type RankOptions } from './ranking'

// ── Services ─────────────────────────────────────────────────────────────────
export {
  createCollegeService,
  createBranchService,
  createPlacementService,
  createFinanceService,
  createResearchService,
  createInstitutionService,
  type CollegeRetrievalService,
  type BranchRetrievalService,
  type PlacementRetrievalService,
  type FinanceRetrievalService,
  type ResearchRetrievalService,
  type InstitutionRetrievalService,
  type ConsultancyFigures,
  type PatentFigures,
} from './services'

// ── Search ───────────────────────────────────────────────────────────────────
export { createSearchEngine, type SearchEngine, type SearchFactServices } from './search'
