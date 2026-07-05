/**
 * @module lib/ai/knowledge/health/health-check
 *
 * The capability interface for anything that can report its own health. Every
 * {@link KnowledgeRepository} implements it. Interface only.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { SourceHealth } from './source-health'

/** A component that can report a {@link SourceHealth} on demand. */
export interface HealthCheck {
  /**
   * Report current health.
   * @param context The current turn's request context (for auth-scoped probes).
   */
  health(context: RequestContext): Promise<SourceHealth>
}
