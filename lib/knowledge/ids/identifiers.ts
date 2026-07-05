/**
 * @module lib/knowledge/ids/identifiers
 *
 * Branded identifier types for the Canonical Knowledge Warehouse. Branding makes
 * the two source identifier systems (TNEA `counselling_code` vs NIRF `nirf_id`)
 * and the derived canonical ids mutually non-assignable at compile time. Reuses
 * the generic `Brand` primitive from the shared layer (no duplication).
 */

import type { Brand } from '@/lib/ai/shared'

/** Canonical, warehouse-assigned college identifier. */
export type CanonicalCollegeId = Brand<string, 'CanonicalCollegeId'>
/** Canonical branch (course) identifier. */
export type CanonicalBranchId = Brand<string, 'CanonicalBranchId'>
/** Reservation community code (e.g. `OC`, `BC`). */
export type CommunityCode = Brand<string, 'CommunityCode'>
/** Canonical placement-record identifier. */
export type PlacementId = Brand<string, 'PlacementId'>
/** Canonical faculty-record identifier. */
export type FacultyId = Brand<string, 'FacultyId'>
/** Canonical research-record identifier. */
export type ResearchId = Brand<string, 'ResearchId'>
/** Canonical finance-record identifier. */
export type FinanceId = Brand<string, 'FinanceId'>
/** NIRF institution identifier, e.g. `IR-E-U-0439`. */
export type NirfId = Brand<string, 'NirfId'>
/** TNEA counselling code, e.g. `1101`. */
export type CounsellingCode = Brand<string, 'CounsellingCode'>

function requireNonEmpty(value: string, kind: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length === 0) throw new Error(`${kind} must be a non-empty string`)
  return trimmed
}

/** Construct a validated {@link NirfId}. */
export function nirfId(value: string): NirfId {
  return requireNonEmpty(value, 'NirfId') as NirfId
}
/** Construct a validated {@link CounsellingCode}. */
export function counsellingCode(value: string): CounsellingCode {
  return requireNonEmpty(value, 'CounsellingCode') as CounsellingCode
}
/** Construct a validated {@link CommunityCode}. */
export function communityCode(value: string): CommunityCode {
  return requireNonEmpty(value, 'CommunityCode').toUpperCase() as CommunityCode
}
