/**
 * @module lib/ai/knowledge/contracts/source
 *
 * The source descriptor — a source-agnostic identity for a registered knowledge
 * source. Interface only.
 */

import type { KnowledgeMetadata } from '../metadata'
import type { KnowledgeSourceId, KnowledgeSourceType } from './identifiers'

/**
 * Describes a registered knowledge source without exposing how it is backed
 * (SQL, document, vector, cache, API). This descriptor is what the registry
 * catalogs and lists.
 */
export interface KnowledgeSource {
  /** Stable, unique source identifier. */
  readonly id: KnowledgeSourceId
  /** The kind of source. */
  readonly type: KnowledgeSourceType
  /** Human-readable name. */
  readonly name: string
  /** Human-readable description of what the source provides. */
  readonly description: string
  /** Source-level metadata. */
  readonly metadata: KnowledgeMetadata
}
