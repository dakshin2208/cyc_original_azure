/**
 * @module lib/ai/orchestration/query/normalizer
 *
 * QuestionNormalizer — deterministically lower-cases, strips noise punctuation,
 * collapses whitespace, and applies a common-typo map token-by-token. Preserves
 * `&`, `/`, `-`, and decimal points (needed for "ai&ds", "v/s", "cut-off",
 * "195.5"). Pure; no AI.
 */

import { TYPO_MAP } from './patterns'

/** A normalized question. */
export interface NormalizedQuestion {
  /** The original, untouched input. */
  readonly raw: string
  /** Cleaned, lower-cased, typo-corrected text. */
  readonly normalized: string
  /** Whitespace tokens of {@link normalized}. */
  readonly tokens: readonly string[]
}

const DECIMAL = /^\d+(\.\d+)?$/

/** Correct a single token via the typo map (identity when not listed). */
function correct(token: string): string {
  return TYPO_MAP[token] ?? token
}

/** Trim non-alphanumeric edges from a token, but keep pure decimals intact. */
function trimEdges(token: string): string {
  if (DECIMAL.test(token)) return token
  return token.replace(/^[^a-z0-9&]+/, '').replace(/[^a-z0-9&]+$/, '')
}

/** Normalize a raw question deterministically. */
export function normalizeQuestion(raw: string): NormalizedQuestion {
  const cleaned = (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9&/.\- ]+/g, ' ') // keep letters, digits, & / . -
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned
    .split(' ')
    .map(trimEdges)
    .filter((t) => t.length > 0)
    .map(correct)

  return { raw: raw ?? '', normalized: tokens.join(' '), tokens }
}

/** The QuestionNormalizer component. */
export interface QuestionNormalizer {
  normalize(raw: string): NormalizedQuestion
}

/** Create the (stateless) question normalizer. */
export function createQuestionNormalizer(): QuestionNormalizer {
  return Object.freeze({ normalize: normalizeQuestion })
}
