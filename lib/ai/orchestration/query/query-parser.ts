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
import { OUT_OF_DOMAIN } from './patterns'

/**
 * Detect a non-engineering domain (medical/law/arts/…) the warehouse cannot serve.
 * Guarded: an engineering branch, or the word "engineering"/"polytechnic", keeps the
 * query in-domain so a valid engineering question is never wrongly declined (RC6).
 */
function detectOutOfDomain(normalized: string, branch: string | null): string | null {
  if (branch !== null) return null
  const padded = ` ${normalized} `
  if (padded.includes(' engineering ') || padded.includes(' polytechnic ')) return null
  for (const domain of Object.keys(OUT_OF_DOMAIN)) {
    if (OUT_OF_DOMAIN[domain].some((kw) => padded.includes(` ${kw} `))) return domain
  }
  return null
}

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
      outOfDomain: detectOutOfDomain(normalized, extraction.branch),
    }
  }

  return Object.freeze({ parse })
}
