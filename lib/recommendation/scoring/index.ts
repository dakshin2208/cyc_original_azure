/**
 * @module lib/recommendation/scoring
 * Barrel for the College Scoring Engine (Module 2).
 */

export {
  type RawDimension,
  clamp01,
  ratio,
  normalizeToRef,
  blend,
  EXTRACTORS,
} from './normalizers'
export { type ScoringEngine, createScoringEngine } from './scoring-engine'
