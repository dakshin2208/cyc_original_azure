/**
 * @module lib/knowledge/nirf2026/types
 *
 * Types for the 2026 canonical NIRF dataset (`2026_final_NIRF_data.csv`) — a
 * college-level enrichment source added ADDITIVELY to the warehouse. It never
 * overwrites existing datasets; each row is normalized into a {@link Nirf2026Profile}
 * and merged onto an existing {@link CanonicalCollege} via a NIRF → CollegeCode →
 * name cascade (see `merge.ts`). No recommendation/ranking logic lives here.
 */

import type { CanonicalCollegeId } from '../ids'

/** One normalized row of the 2026 dataset. Numeric fields are `null` when blank. */
export interface Nirf2026Profile {
  /** Source row index (1-based, excluding header) — for the merge report. */
  readonly row: number
  /** NIRF institution id, e.g. `IR-E-C-36995` (uppercased/trimmed) or null. */
  readonly nirfCode: string | null
  /** TNEA counselling code, e.g. `2718`, as a trimmed string, or null. */
  readonly collegeCode: string | null
  /** Short institute name (may be blank). */
  readonly instituteName: string | null
  /** Full college name (always present in the source). */
  readonly collegeName: string
  /** `comparisonKey(collegeName)` — for name-based matching. */
  readonly nameKey: string
  /** `comparisonKey(instituteName)` when present — secondary name key. */
  readonly instituteNameKey: string | null

  // ── Placement / outcomes ───────────────────────────────────────────────────
  readonly avgMedianSalary: number | null
  readonly avgPlacementPercentage: number | null
  readonly avgPassingPercentage: number | null
  readonly avgHigherStudiesPercentage: number | null
  readonly careerOutcome: number | null
  readonly idleOutputIndex: number | null

  // ── Intake / demographics ──────────────────────────────────────────────────
  readonly totalIntake: number | null
  readonly avgSeatsFilled: number | null
  readonly avgWomenStudents: number | null
  readonly avgOutsideStudents: number | null
  readonly avgScholarshipPercentage: number | null

  // ── Eligibility / location ─────────────────────────────────────────────────
  /** OC-community closing cutoff (TNEA aggregate marks, 0–200). */
  readonly ocCutoff: number | null
  readonly state: string | null
  readonly district: string | null

  // ── Composite scores (opaque; provided by the dataset) ─────────────────────
  readonly powerScore: number | null
}

/** How a profile was matched to an existing college. */
export type MergeMethod = 'nirf' | 'collegeCode' | 'name'

/** A profile successfully merged onto an existing canonical college. */
export interface Nirf2026Match {
  readonly collegeId: CanonicalCollegeId
  readonly method: MergeMethod
  readonly profile: Nirf2026Profile
}

/** A row that matched a college already claimed by an earlier row (kept: earlier). */
export interface Nirf2026Duplicate {
  readonly row: number
  readonly collegeName: string
  readonly collegeId: CanonicalCollegeId
  readonly method: MergeMethod
  readonly keptRow: number
}

/** A row that matched no existing college (candidate to add). */
export interface Nirf2026Unmatched {
  readonly row: number
  readonly collegeName: string
  readonly nirfCode: string | null
  readonly collegeCode: string | null
  readonly district: string | null
}

/** The merge audit — matched / added / unmatched / duplicates / missing fields. */
export interface Nirf2026MergeReport {
  readonly totalRows: number
  readonly matched: number
  readonly matchedByMethod: Readonly<Record<MergeMethod, number>>
  /**
   * Colleges newly INJECTED into the canonical catalog by this merge. 0 in this
   * phase (additive-safe): unmatched rows are surfaced as candidates below, not
   * auto-added, so the recommendation input set stays unchanged.
   */
  readonly added: number
  /** Rows not matched to any existing college — candidates to add in a later phase. */
  readonly unmatched: readonly Nirf2026Unmatched[]
  /** Rows dropped because their college was already matched by an earlier row. */
  readonly duplicates: readonly Nirf2026Duplicate[]
  /** Per-field count of rows where the value is blank/null. */
  readonly missingFields: Readonly<Record<string, number>>
  /** Rows skipped entirely (e.g. no college name). */
  readonly rowsSkipped: number
}

/** The merged 2026 dataset attached to the warehouse (additive, read-only). */
export interface Nirf2026Dataset {
  /** Every normalized profile, in source order. */
  readonly profiles: readonly Nirf2026Profile[]
  /** Matched profile by canonical college id (first match wins). */
  readonly byCollege: ReadonlyMap<CanonicalCollegeId, Nirf2026Profile>
  /** The merge audit. */
  readonly report: Nirf2026MergeReport
}
