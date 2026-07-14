/**
 * @module lib/ai/orchestration/query/intent-classifier
 *
 * IntentClassifier — scores each intent from trigger-phrase matches plus
 * entity-derived boosts (e.g. two colleges ⇒ compare, cutoff+community ⇒
 * eligibility), then picks the highest, breaking ties by a fixed priority. Fully
 * deterministic; no AI.
 */

import type { QueryIntent } from '../models'
import type { ExtractionOutput } from './entity-extractor'
import { EVALUATIVE_RE, INTENT_PRIORITY, INTENT_RULES } from './patterns'

/** An intent decision with confidence. */
export interface IntentDecision {
  readonly intent: QueryIntent
  readonly confidence: number
}

/** The IntentClassifier component. */
export interface IntentClassifier {
  classify(normalized: string, extraction: ExtractionOutput): IntentDecision
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Create the (stateless) intent classifier. */
export function createIntentClassifier(): IntentClassifier {
  const classify = (normalized: string, extraction: ExtractionOutput): IntentDecision => {
    const padded = ` ${normalized} `
    const scores = new Map<QueryIntent, number>()
    const add = (intent: QueryIntent, delta: number): void =>
      void scores.set(intent, (scores.get(intent) ?? 0) + delta)

    // Phrase matches. Every phrase is word-bounded (trimmed + space-padded) so a
    // shorter phrase never matches inside a longer token (e.g. "best college"
    // must NOT match inside "best colleges").
    for (const rule of INTENT_RULES) {
      for (const phrase of rule.phrases) {
        if (padded.includes(` ${phrase.trim()} `)) add(rule.intent, rule.weight)
      }
    }

    // Entity-derived boosts.
    if (extraction.colleges.length >= 2) add('compare_colleges', 4)
    if (extraction.studentCutoff !== null && extraction.community !== null) add('eligibility_query', 3)
    if (extraction.studentCutoff !== null) add('eligibility_query', 1)
    if (extraction.branch !== null) add('branch_advice', 1)

    // A NAMED college out-weighs the weak "best"/"good" scaffolding: "is Kumaraguru the
    // best college?" is a question ABOUT Kumaraguru, not a request for a global top-N.
    // Only when EXACTLY ONE college is resolved — zero colleges is a true global ask
    // ("which college is best for me?"), and two+ is a comparison (boosted above).
    if (extraction.colleges.length === 1 && EVALUATIVE_RE.test(normalized)) {
      add('general_information', 4)
    }

    // Rank the candidates.
    const ranked = [...scores.entries()].sort(
      (a, b) => b[1] - a[1] || INTENT_PRIORITY[b[0]] - INTENT_PRIORITY[a[0]],
    )
    const top = ranked[0]
    const collegesPresent = extraction.colleges.length > 0

    if (!top || top[1] === 0) {
      return collegesPresent
        ? { intent: 'general_information', confidence: 0.4 }
        : { intent: 'unknown', confidence: 0.2 }
    }

    const second = ranked[1]?.[1] ?? 0
    const confidence = clamp01(0.55 + 0.1 * (top[1] - second) + 0.03 * top[1])
    return { intent: top[0], confidence }
  }

  return Object.freeze({ classify })
}
