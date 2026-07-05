/**
 * @module lib/ai/orchestration/query
 * Barrel for Query Understanding (Module 1).
 */

export {
  type NormalizedQuestion,
  type QuestionNormalizer,
  normalizeQuestion,
  createQuestionNormalizer,
} from './normalizer'
export {
  type CollegeCandidate,
  type QueryLexicon,
  createQueryLexicon,
} from './lexicon'
export {
  type ExtractionOutput,
  type EntityExtractor,
  createEntityExtractor,
} from './entity-extractor'
export {
  type IntentDecision,
  type IntentClassifier,
  createIntentClassifier,
} from './intent-classifier'
export { type QueryParser, createQueryParser } from './query-parser'
export * as patterns from './patterns'
