/**
 * @module lib/ai/ingestion/factory/dependencies
 *
 * The dependency bundle injected into the ingestion factory. Sourced from the
 * runtime container. Only a clock is required now (to stamp requests). Interface
 * only.
 */

import type { ClockPort } from '@/lib/ai/shared'

/** Infrastructure ports the ingestion factory depends on. */
export interface IngestionDependencies {
  /** Time source for request timestamps. */
  readonly clock: ClockPort
}
