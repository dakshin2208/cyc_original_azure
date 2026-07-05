/**
 * @module lib/ai/retrieval/sources/domain-repositories
 *
 * Domain knowledge-source contracts (Module 2). Each is a specialization of the
 * Sprint 3 {@link KnowledgeRepository} over a domain content type — reachable
 * through the same base interface as everything else, so the retriever stays
 * source-agnostic. The generic document and structured repositories are reused
 * verbatim from the Knowledge Access Layer (re-exported, not redefined).
 * Interfaces only.
 */

import type { KnowledgeRepository } from '@/lib/ai/knowledge'
import type {
  BranchContent,
  CollegeContent,
  CutoffContent,
  FeeContent,
  StatisticsContent,
} from './content'

/** Repository of college records. */
export type CollegeRepository = KnowledgeRepository<CollegeContent>
/** Repository of branch records. */
export type BranchRepository = KnowledgeRepository<BranchContent>
/** Repository of cutoff records. */
export type CutoffRepository = KnowledgeRepository<CutoffContent>
/** Repository of statistics records. */
export type StatisticsRepository = KnowledgeRepository<StatisticsContent>
/** Repository of fee records. */
export type FeeRepository = KnowledgeRepository<FeeContent>

// The generic document and structured-data repositories already exist in the
// Knowledge Access Layer; re-export them so all source contracts are reachable
// from `@/lib/ai/retrieval` (reuse, not duplication).
export type { DocumentRepository, SqlRepository } from '@/lib/ai/knowledge'
