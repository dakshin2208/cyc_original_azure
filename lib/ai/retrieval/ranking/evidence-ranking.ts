/**
 * @module lib/ai/retrieval/ranking/evidence-ranking
 *
 * Evidence ranking models (Module 7). `EvidenceRanking` is the computed score
 * attached to each piece of evidence; `RankingWeights`/`RankingStrategy` describe
 * how the components are combined. Models only — no scoring logic.
 */

/** The ranking components computed for a piece of evidence. All in [0, 1]. */
export interface EvidenceRanking {
  /** Overall ranking score (the combined result). */
  readonly score: number
  /** Confidence in the evidence. */
  readonly confidence: number
  /** How recent the underlying data is. */
  readonly freshness: number
  /** How complete the evidence is. */
  readonly completeness: number
  /** Source/priority weighting. */
  readonly priority: number
}

/** Weights for combining ranking components into an overall score. */
export interface RankingWeights {
  /** Weight of confidence. */
  readonly confidence: number
  /** Weight of freshness. */
  readonly freshness: number
  /** Weight of completeness. */
  readonly completeness: number
  /** Weight of priority. */
  readonly priority: number
}

/** A named ranking strategy: the weights applied when scoring evidence. */
export interface RankingStrategy {
  /** Strategy name (for observability/selection). */
  readonly name: string
  /** The component weights. */
  readonly weights: RankingWeights
}
