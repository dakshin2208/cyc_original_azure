/**
 * @module lib/ai/query/intent/intent-type
 *
 * The query-understanding intent taxonomy. This is finer-grained than the
 * question-audit `IntentCategory` in `@/lib/ai/shared` (which classifies at the
 * capability level); here we classify the *user's ask* so downstream layers can
 * route precisely. New intents are added centrally here (single source of truth).
 *
 * Value list + derived union — a model, not logic.
 */

/** All recognized query intents (frozen single source of truth). */
export const QUERY_INTENT_TYPES = [
  /** A factual/definitional question ("What is AI & DS?"). */
  'information',
  /** A request for advice/opinion ("Which colleges should I join?"). */
  'recommendation',
  /** A head-to-head comparison ("Compare PSG and Kumaraguru"). */
  'comparison',
  /** A feasibility check ("Can I get CSE with 186?"). */
  'eligibility',
  /** A direct cutoff/rank lookup for a college/branch. */
  'cutoff_lookup',
  /** Discovery of colleges by criteria. */
  'college_search',
  /** Discovery of branches/courses by criteria. */
  'branch_search',
  /** Questions about the counselling process/timeline. */
  'counselling_process',
  /** Questions about fees/cost. */
  'fees',
  /** Questions about placements/outcomes. */
  'placement',
  /** Questions about admission steps/eligibility rules. */
  'admission',
  /** Intent could not be determined. */
  'unknown',
] as const

/** A single recognized query intent. */
export type QueryIntentType = (typeof QUERY_INTENT_TYPES)[number]
