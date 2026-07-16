/**
 * @module lib/knowledge/cutoffs/community-cutoffs
 *
 * College-level, community-wise closing cutoffs derived from the TNEA cutoff dataset
 * (`Ftnea_cutoffs.csv`). For each counselling code we take the most recent year on
 * file and, per community (OC/BC/BCM/MBC/SC/SCA/ST), the MEDIAN closing mark across
 * that college's branches — a robust college-level "typical mark to get in" that a
 * counselor reasons with (a reserved student is judged against their OWN community's
 * marks, not the OC band). Branch-specific refinement is future work. Deterministic.
 */

import type { CsvRow } from '../csv/csv-parser'
import { normalizeBranch } from '../normalization'

/** counselling code → { community code → median closing cutoff }. */
export type CommunityCutoffs = ReadonlyMap<string, Readonly<Record<string, number>>>

/** counselling code → set of CANONICAL branch names offered (from the TNEA cutoff dataset). */
export type BranchOfferings = ReadonlyMap<string, ReadonlySet<string>>

/**
 * Parse the TNEA cutoff rows into the set of CANONICAL branches each counselling code
 * offers. The raw `branch` column carries the many spellings the source uses (e.g.
 * "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE", "Computer Science and Engineering"); each
 * is normalized to its canonical name so a student's "AI & DS" / "CSE" matches. Rows with
 * no counselling code or no branch are skipped (never guessed). Deterministic.
 */
export function parseBranchOfferings(rows: readonly CsvRow[]): BranchOfferings {
  const out = new Map<string, Set<string>>()
  for (const row of rows) {
    const code = (row.counselling_code ?? '').trim()
    const rawBranch = (row.branch ?? '').trim()
    if (code === '' || rawBranch === '') continue
    const canonical = normalizeBranch(rawBranch).canonicalName
    if (canonical === '') continue
    let set = out.get(code)
    if (!set) {
      set = new Set<string>()
      out.set(code, set)
    }
    set.add(canonical)
  }
  return out
}

/** TNEA cutoff column → canonical community code. */
const COMMUNITY_COLUMNS: readonly (readonly [string, string])[] = [
  ['oc', 'OC'],
  ['bc', 'BC'],
  ['bcm', 'BCM'],
  ['mbc', 'MBC'],
  ['sc', 'SC'],
  ['sca', 'SCA'],
  ['st', 'ST'],
]

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

/**
 * Parse TNEA cutoff rows into per-college (counselling-code), per-community median
 * closing cutoffs, using the most recent year present for each college. Rows with no
 * counselling code, or communities with no positive marks, are skipped (never guessed).
 */
export function parseCommunityCutoffs(rows: readonly CsvRow[]): CommunityCutoffs {
  const byCode = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const code = (row.counselling_code ?? '').trim()
    if (code === '') continue
    let group = byCode.get(code)
    if (!group) {
      group = []
      byCode.set(code, group)
    }
    group.push(row)
  }

  const out = new Map<string, Record<string, number>>()
  for (const [code, group] of byCode) {
    let latestYear = Number.NEGATIVE_INFINITY
    for (const r of group) {
      const y = Number(r.year)
      if (Number.isFinite(y) && y > latestYear) latestYear = y
    }
    const latest = group.filter((r) => Number(r.year) === latestYear)
    const record: Record<string, number> = {}
    for (const [column, community] of COMMUNITY_COLUMNS) {
      const marks = latest
        .map((r) => Number(r[column]))
        .filter((v) => Number.isFinite(v) && v > 0)
      if (marks.length > 0) record[community] = median(marks)
    }
    if (Object.keys(record).length > 0) out.set(code, record)
  }
  return out
}
