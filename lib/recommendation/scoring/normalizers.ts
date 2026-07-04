/**
 * @module lib/recommendation/scoring/normalizers
 *
 * Pure numeric helpers and per-dimension raw-metric extractors. Each extractor
 * reads a {@link CollegeProfile} and returns a {@link RawDimension}: the primary
 * raw metric (for evidence/traceability) and the normalized score in [0, 1], or
 * `null` when the dimension has no backing data. Fully deterministic; no side
 * effects, no AI.
 */

import type { NormalizationRefs } from '../config'
import type { CollegeProfile, ScoreDimension } from '../models'

/** A dimension's raw metric and its normalized [0, 1] value (`null` = no data). */
export interface RawDimension {
  /** The primary underlying metric, or `null`. */
  readonly raw: number | null
  /** Normalized score in [0, 1], or `null` when no data backs the dimension. */
  readonly value: number | null
}

const NO_DATA: RawDimension = { raw: null, value: null }

/** Clamp a number into [0, 1]. */
export function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

/** `part / whole` when `whole > 0`, else `null`. */
export function ratio(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null
  return part / whole
}

/** Normalize a value against a positive reference into [0, 1], or `null`. */
export function normalizeToRef(value: number | null, ref: number): number | null {
  if (value === null || ref <= 0) return null
  return clamp01(value / ref)
}

/** Average of the non-null values, or `null` when all are null. */
export function blend(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

// ── Per-dimension extractors ─────────────────────────────────────────────────

/** Placement: blend of normalized median salary and placement rate. */
function placement(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const s = p.placement
  if (!s) return NO_DATA
  const salaryNorm = normalizeToRef(s.medianSalary, refs.medianSalaryRef)
  const rateNorm = s.placementPercentage === null ? null : clamp01(s.placementPercentage / 100)
  const value = blend([salaryNorm, rateNorm])
  return { raw: s.medianSalary, value }
}

/** Faculty: blend of PhD ratio, retention ratio, and normalized size. */
function faculty(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const f = p.faculty
  if (!f || f.total <= 0) return NO_DATA
  const phdRatio = ratio(f.withPhd, f.total)
  const retention = ratio(f.currentlyWorking, f.total)
  const sizeNorm = normalizeToRef(f.total, refs.facultySizeRef)
  return { raw: f.total, value: blend([phdRatio, retention, sizeNorm]) }
}

/** Research: blend of normalized patents, sponsored projects, and PhDs produced. */
function research(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const r = p.research
  if (!r) return NO_DATA
  const patentsNorm = normalizeToRef(r.patentsPublished, refs.researchPatentsRef)
  const projectsNorm = normalizeToRef(r.sponsoredProjects, refs.researchProjectsRef)
  const phdNorm = normalizeToRef(r.phdGraduated, refs.researchPhdRef)
  const value = blend([patentsNorm, projectsNorm, phdNorm])
  return { raw: r.patentsPublished, value }
}

/** Infrastructure: normalized capital expenditure. */
function infrastructure(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const capex = p.finance?.capitalExpenditure ?? null
  return { raw: capex, value: normalizeToRef(capex, refs.capitalExpenditureRef) }
}

/** Financial strength: normalized operating expenditure. */
function financialStrength(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const opex = p.finance?.operatingExpenditure ?? null
  return { raw: opex, value: normalizeToRef(opex, refs.operatingExpenditureRef) }
}

/** Academic reputation: normalized count of PhD scholars currently pursuing. */
function academicReputation(p: CollegeProfile, refs: NormalizationRefs): RawDimension {
  const inst = p.institution
  if (!inst) return NO_DATA
  const scholars = (inst.phdFulltimePursuing ?? 0) + (inst.phdParttimePursuing ?? 0)
  return { raw: scholars, value: normalizeToRef(scholars, refs.academicPhdScholarsRef) }
}

/** NIRF presence: a binary, always-known signal. */
function nirfPresence(p: CollegeProfile): RawDimension {
  const present = p.college.hasNirfData ? 1 : 0
  return { raw: present, value: present }
}

/**
 * Available branches: the warehouse has NO per-college branch linkage (see the
 * Knowledge Audit), so this dimension has no backing data today and is
 * renormalized out of every score. Wired for a future dataset.
 */
function availableBranches(_p: CollegeProfile): RawDimension {
  return NO_DATA
}

/** Data completeness: fraction of the five fact facets present (always known). */
function dataCompleteness(p: CollegeProfile): RawDimension {
  const facets = [p.placement, p.finance, p.research, p.faculty, p.institution]
  const present = facets.filter((f) => f !== null).length
  return { raw: present, value: present / facets.length }
}

/** The extractor table, keyed by dimension. */
export const EXTRACTORS: Readonly<
  Record<ScoreDimension, (p: CollegeProfile, refs: NormalizationRefs) => RawDimension>
> = {
  placement,
  faculty,
  research,
  infrastructure,
  financialStrength,
  academicReputation,
  nirfPresence: (p) => nirfPresence(p),
  availableBranches: (p) => availableBranches(p),
  dataCompleteness: (p) => dataCompleteness(p),
}
