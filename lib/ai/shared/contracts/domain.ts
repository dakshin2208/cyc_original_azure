/**
 * @module lib/ai/shared/contracts/domain
 *
 * Canonical domain models for the AI platform.
 *
 * Reuse policy (do NOT duplicate existing models): the college-quality
 * parameter model, the reservation/plan model, and the auth user model already
 * exist in the application. We re-export them **type-only** so every AI module
 * imports them from a single seam (`@/lib/ai/shared`) while they continue to
 * resolve to their original definitions. `export type` is fully erased at
 * compile time, so this introduces **no runtime import** of the underlying
 * modules (and therefore no side effects and no dependency cycles).
 *
 * The only new model defined here is {@link CollegeRef}: a lightweight identity
 * for a college that deliberately carries *both* identifier systems. We do not
 * introduce a third `College` shape — the app already defines two divergent
 * ones (`lib/college-data.ts`, `lib/college-service.ts`); rich attributes are
 * consumed via {@link CollegeParameters}.
 */

import type { CollegeCode, CounsellingCode, NirfId } from '../ids'

// ── Reused: computed college parameters (L4 engine, doc 01) ──────────────────
export type {
  CollegeParameters,
  FacultyParameters,
  AdmissionsDemandParameters,
  FinancialParameters,
  ResearchParameters,
  StudentCompositionParameters,
  InfrastructureParameters,
  CrossSchemaParameters,
  TrendDirection,
} from '@/lib/parameters'

// ── Reused: parameter catalog metadata (search/compare columns) ──────────────
export type { ApiSection, ParamFormat, NewParam, NewParamGroup } from '@/lib/parameters-catalog'

// ── Reused: choice-filling plan model (entitlements) ─────────────────────────
export type { PlanType, PlanLimits } from '@/lib/plans'

// ── Reused: authenticated user model ─────────────────────────────────────────
export type { User } from '@/lib/supabase'

/**
 * A minimal, identity-only reference to a college.
 *
 * Carries both identifier systems so downstream modules can bridge TNEA
 * admissions data (`counsellingCode`) and NIRF quality data (`nirfId`) without
 * re-deriving the mapping. Either linked identifier may be `null` when a college
 * lacks that linkage (Knowledge Audit, doc 01 §0).
 */
export interface CollegeRef {
  /** Product-level college code (L1 `colleges`/`Cutoff`). */
  readonly collegeCode: CollegeCode
  /** TNEA counselling code linking `tnea_*` data, or `null` if unlinked. */
  readonly counsellingCode: CounsellingCode | null
  /** NIRF institution id linking `nirf_*` data, or `null` if unlinked. */
  readonly nirfId: NirfId | null
  /** Human-readable college name for display. */
  readonly name: string
}
