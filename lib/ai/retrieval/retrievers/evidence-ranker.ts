/**
 * @module lib/ai/retrieval/retrievers/evidence-ranker
 *
 * The evidence-ranker contract (Module 8). Orders retrieved evidence according
 * to a {@link RankingStrategy}. Interface only — no ranking logic here.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { RetrievedEvidence } from '../context'
import type { RankingStrategy } from '../ranking'

/** Ranks/orders retrieved evidence. */
export interface EvidenceRanker {
  /**
   * Rank evidence by the given strategy, returning it in ranked order.
   * @param evidence The evidence to rank.
   * @param strategy The ranking strategy (weights).
   * @param context  The current turn's request context.
   */
  rank(
    evidence: readonly RetrievedEvidence[],
    strategy: RankingStrategy,
    context: RequestContext,
  ): readonly RetrievedEvidence[]
}
