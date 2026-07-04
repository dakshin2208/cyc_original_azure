/**
 * @module lib/retrieval/services/aggregation
 * Small numeric aggregation helpers shared by the fact-summary services.
 */

/** Sum the non-null values, or `null` when all are null. */
export function sumNonNull(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0)
}

/** Maximum of the non-null values, or `null` when all are null. */
export function maxNonNull(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : Math.max(...present)
}

/** Mean of the non-null values (rounded), or `null` when all are null. */
export function avgNonNull(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length)
}

/** Round to `dp` decimal places. */
export function roundTo(value: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}
