/**
 * @module lib/ai/query/normalization/query-normalizer
 *
 * The normalizer contract (Module 7). Interface only. A future implementation
 * will resolve aliases — college names, branch names, community/category labels,
 * district names, etc. — to canonical values. No alias tables or logic here.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { QueryEntity } from '../entities'

/** The outcome of resolving one alias to its canonical form. */
export interface AliasResolution {
  /** The canonical value. */
  readonly canonical: string
  /** The raw alias that was matched. */
  readonly matched: string
  /** Resolution confidence in [0, 1]. */
  readonly confidence: number
}

/** Normalizes query text and resolves entity aliases to canonical values. */
export interface QueryNormalizer {
  /**
   * Normalize raw query text (casing, whitespace, punctuation, transliteration).
   * @param text The raw text.
   */
  normalizeText(text: string): string

  /**
   * Resolve extracted entities' aliases to canonical normalized values.
   * @param entities The extracted entities.
   * @param context  The current turn's request context.
   */
  normalizeEntities(
    entities: readonly QueryEntity[],
    context: RequestContext,
  ): Promise<readonly QueryEntity[]>
}
