/**
 * @module lib/ai/retrieval/sources/content
 *
 * The content shapes carried by records from each domain repository. These reuse
 * shared domain models where they exist ({@link CollegeRef}, {@link CollegeParameters},
 * {@link Community}) rather than redefining them. Models only.
 */

import type { CollegeParameters, CollegeRef, Community } from '@/lib/ai/shared'

/** Content of a college record. */
export interface CollegeContent {
  /** Identity of the college. */
  readonly ref: CollegeRef
  /** Computed parameters, when available. */
  readonly parameters: CollegeParameters | null
}

/** Content of a branch record. */
export interface BranchContent {
  /** Branch code. */
  readonly code: string
  /** Branch name. */
  readonly name: string
  /** Owning college code. */
  readonly collegeCode: string
}

/** Content of a cutoff record (closing mark/rank for a community). */
export interface CutoffContent {
  /** College code. */
  readonly collegeCode: string
  /** Branch code. */
  readonly branchCode: string
  /** Reservation community. */
  readonly community: Community
  /** Closing value (mark or rank). */
  readonly value: number
  /** Admission year, when known. */
  readonly year: number | null
}

/** Content of a statistics record. */
export interface StatisticsContent {
  /** Metric name. */
  readonly metric: string
  /** Metric value. */
  readonly value: number
  /** Unit of measure, when applicable. */
  readonly unit: string | null
  /** Reference year, when applicable. */
  readonly year: number | null
}

/** Content of a fee record. */
export interface FeeContent {
  /** College code. */
  readonly collegeCode: string
  /** Fee category. */
  readonly category: string
  /** Annual fee in INR. */
  readonly amountInr: number
  /** Reference year, when known. */
  readonly year: number | null
}

/** Content of a document record — text. */
export type DocumentContent = string
