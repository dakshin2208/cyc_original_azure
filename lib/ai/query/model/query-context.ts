/**
 * @module lib/ai/query/model/query-context
 *
 * Minimal, non-conversational context attached to a structured query. This layer
 * deliberately carries NO conversation history or memory — only the locale, a
 * creation timestamp, and an optional link to the owning turn. Model only.
 */

import type { TurnId } from '@/lib/ai/shared'

/** Stateless context for a single query (no history/memory by design). */
export interface QueryContext {
  /** BCP-47 locale the query was understood in. */
  readonly locale: string
  /** ISO-8601 timestamp when the structured query was produced. */
  readonly createdAt: string
  /** The owning request turn, when the query originates from one. */
  readonly turnId: TurnId | null
}
