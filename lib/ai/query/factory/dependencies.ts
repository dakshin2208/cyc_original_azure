/**
 * @module lib/ai/query/factory/dependencies
 *
 * The dependency bundle injected into the query factory. Sourced from the
 * runtime container. Currently only a clock is required (for timestamps); the
 * bundle is the seam through which future infrastructure is added without
 * changing call sites. Interface only.
 */

import type { ClockPort } from '@/lib/ai/shared'

/** Infrastructure ports the query factory depends on. */
export interface QueryDependencies {
  /** Time source for query timestamps. */
  readonly clock: ClockPort
}
