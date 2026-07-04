/**
 * @module lib/retrieval/ranking/similarity
 *
 * Deterministic string-similarity primitives (Levenshtein edit distance). Used
 * only for fuzzy/misspelling matching in the ranker. No AI, no embeddings.
 */

/** Classic dynamic-programming Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/**
 * Normalized similarity in [0, 1]: `1 - distance / maxLength`. Returns 1 for
 * identical strings and 0 for empty inputs.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}
