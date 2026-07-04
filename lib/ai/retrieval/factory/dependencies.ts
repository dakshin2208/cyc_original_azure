/**
 * @module lib/ai/retrieval/factory/dependencies
 *
 * The dependency bundle injected into the retrieval factory. Sourced from the
 * runtime container. Only a clock is required now (to stamp requests); the
 * bundle is the seam for adding infrastructure later without changing call
 * sites. Interface only.
 */

import type { ClockPort } from '@/lib/ai/shared'

/** Infrastructure ports the retrieval factory depends on. */
export interface RetrievalDependencies {
  /** Time source for request timestamps. */
  readonly clock: ClockPort
}
