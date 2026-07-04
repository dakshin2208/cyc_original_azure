/**
 * @module lib/knowledge/validation/validators
 *
 * Lightweight row validators. Transformers use these to reject malformed rows
 * (collecting issues) rather than throwing, so a single bad row never fails the
 * whole warehouse build.
 */

import type { CsvRow } from '../csv'
import type { ValidationIssue } from './issues'

/** Return the names of required fields that are missing/blank in a row. */
export function missingFields(row: CsvRow, fields: readonly string[]): string[] {
  return fields.filter((f) => {
    const v = row[f]
    return v === undefined || v.trim() === ''
  })
}

/**
 * Ensure required fields are present. On failure, appends an `error` issue to
 * `issues` and returns `false`.
 * @returns `true` when all required fields are present.
 */
export function requireFields(
  source: string,
  row: CsvRow,
  fields: readonly string[],
  issues: ValidationIssue[],
): boolean {
  const missing = missingFields(row, fields)
  if (missing.length === 0) return true
  issues.push({
    severity: 'error',
    kind: 'missing_field',
    source,
    field: missing.join(', '),
    message: `row skipped — missing required field(s): ${missing.join(', ')}`,
  })
  return false
}
