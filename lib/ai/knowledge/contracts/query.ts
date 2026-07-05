/**
 * @module lib/ai/knowledge/contracts/query
 *
 * A source-agnostic query describing *what* to retrieve, not *how*. Concrete
 * repositories translate this into their native mechanism. Interface only.
 *
 * Note: `text` is a plain lexical/metadata filter hint — this layer defines no
 * semantic/vector search (that is an explicitly out-of-scope future concern).
 */

import type { KnowledgeRecordId } from './identifiers'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/** A single sort instruction. */
export interface SortSpec {
  /** Field to sort by. */
  readonly field: string
  /** Sort direction. */
  readonly direction: SortDirection
}

/** A structured, source-agnostic filter (field → matcher value). */
export type KnowledgeFilter = Readonly<Record<string, unknown>>

/** Pagination window. */
export interface Pagination {
  /** Maximum number of records to return. */
  readonly limit: number
  /** Number of records to skip. */
  readonly offset: number
}

/** A source-agnostic query. All fields are optional; an empty query matches all. */
export interface KnowledgeQuery {
  /** Restrict to specific record ids. */
  readonly ids?: readonly KnowledgeRecordId[]
  /** Structured field filters. */
  readonly filter?: KnowledgeFilter
  /** Optional lexical/metadata text hint (not semantic search). */
  readonly text?: string
  /** Pagination window. */
  readonly pagination?: Pagination
  /** Ordering. */
  readonly sort?: readonly SortSpec[]
}
