/**
 * @module lib/retrieval/ranking
 * Barrel for the deterministic ranking primitives.
 */
export { levenshtein, similarity } from './similarity'
export {
  FUZZY_THRESHOLD,
  scoreCandidate,
  rankCandidates,
  type RankOptions,
} from './ranker'
