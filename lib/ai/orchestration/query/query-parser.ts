/**
 * @module lib/ai/orchestration/query/query-parser
 *
 * QueryParser — composes the QuestionNormalizer, EntityExtractor, and
 * IntentClassifier into a single deterministic pass that turns a raw question
 * into a {@link ParsedQuery}. No AI.
 */

import type { ParsedQuery } from '../models'
import { createEntityExtractor, type EntityExtractor } from './entity-extractor'
import { createIntentClassifier, type IntentClassifier } from './intent-classifier'
import { createQuestionNormalizer, type QuestionNormalizer } from './normalizer'
import type { QueryLexicon } from './lexicon'

/** The QueryParser component. */
export interface QueryParser {
  parse(raw: string): ParsedQuery
}

/** Create the query parser over an injected lexicon (college resolver + locations). */
export function createQueryParser(
  lexicon: QueryLexicon,
  deps?: {
    readonly normalizer?: QuestionNormalizer
    readonly extractor?: EntityExtractor
    readonly classifier?: IntentClassifier
  },
): QueryParser {
  const normalizer = deps?.normalizer ?? createQuestionNormalizer()
  const extractor = deps?.extractor ?? createEntityExtractor(lexicon)
  const classifier = deps?.classifier ?? createIntentClassifier()

  const parse = (raw: string): ParsedQuery => {
    const { normalized, tokens } = normalizer.normalize(raw)
    const extraction = extractor.extract(normalized, tokens)
    const { intent, confidence } = classifier.classify(normalized, extraction)

    return {
      raw,
      normalized,
      tokens,
      intent,
      intentConfidence: confidence,
      entities: extraction.entities,
      colleges: extraction.colleges.map((c) => c.name),
      hasMultipleColleges: extraction.colleges.length >= 2,
      branch: extraction.branch,
      community: extraction.community,
      studentCutoff: extraction.studentCutoff,
      location: extraction.location,
    }
  }

  return Object.freeze({ parse })
}
