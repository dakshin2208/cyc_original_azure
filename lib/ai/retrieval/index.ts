/**
 * @module lib/ai/retrieval
 *
 * Public API of the Knowledge Retrieval Layer (Module 10). The rest of the AI
 * platform imports retrieval types and the factory ONLY from here.
 *
 * This layer receives a {@link StructuredQuery} and produces a
 * {@link RetrievedContext} of ranked, attributed evidence — it does not reason,
 * rank, or generate answers (those are future layers).
 */

// ── Retrieval contracts / output (Module 1) ──────────────────────────────────
export type {
  RetrievedEvidence,
  RetrievedRecord,
  RetrievedDocument,
  RetrievalMetadata,
  SourceRetrievalStatus,
  SourceStatistics,
  RetrievalStatistics,
  RetrievedContext,
} from './context'

// ── Knowledge source contracts (Module 2) ────────────────────────────────────
export { REPOSITORY_KINDS } from './sources'
export type {
  RepositoryKind,
  CollegeContent,
  BranchContent,
  CutoffContent,
  StatisticsContent,
  FeeContent,
  DocumentContent,
  CollegeRepository,
  BranchRepository,
  CutoffRepository,
  StatisticsRepository,
  FeeRepository,
  DocumentRepository,
  SqlRepository,
} from './sources'

// ── Repository selection (Module 3) ──────────────────────────────────────────
export type { RepositorySelection, RepositorySelectionPolicy } from './selection'

// ── Retrieval strategy (Module 4) ────────────────────────────────────────────
export { RETRIEVAL_STRATEGY_KINDS } from './strategy'
export type { RetrievalStrategyKind, RetrievalStrategy } from './strategy'

// ── Retrieval request (Module 5) ─────────────────────────────────────────────
export type { RetrievalRequest } from './request'

// ── Retrieval result (Module 6) ──────────────────────────────────────────────
export type { RetrievalStatus, RetrievalResult } from './result'

// ── Evidence ranking (Module 7) ──────────────────────────────────────────────
export type { EvidenceRanking, RankingWeights, RankingStrategy } from './ranking'

// ── Retriever contracts (Module 8) ───────────────────────────────────────────
export type { RepositorySelector, EvidenceRanker, KnowledgeRetriever } from './retrievers'

// ── Factory / Builder (Module 9) ─────────────────────────────────────────────
export type { RetrievalDependencies, RetrievalFactory } from './factory'
export {
  RetrievalRequestBuilder,
  createRetrievalRequestBuilder,
  createRetrievalFactory,
  DEFAULT_RANKING_STRATEGY,
  DEFAULT_RETRIEVAL_STRATEGY,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
} from './factory'
