/**
 * @module lib/knowledge/nirf2026
 *
 * The 2026 canonical NIRF dataset integration: parse + normalize + merge onto the
 * existing college catalog, additively. Public surface for the warehouse builder.
 */

export type {
  Nirf2026Profile,
  Nirf2026Match,
  Nirf2026Duplicate,
  Nirf2026Unmatched,
  Nirf2026MergeReport,
  Nirf2026Dataset,
  MergeMethod,
} from './types'
export { parseNirf2026, NIRF2026_HEADERS } from './parse'
export { mergeNirf2026, emptyNirf2026Dataset } from './merge'
