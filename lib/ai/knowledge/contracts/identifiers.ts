/**
 * @module lib/ai/knowledge/contracts/identifiers
 *
 * Foundational identifier and discriminator aliases for the Knowledge Access
 * Layer. Kept dependency-free (a leaf) so any other knowledge file may import
 * them without risking a cycle.
 */

/** Opaque identifier of a registered knowledge source. */
export type KnowledgeSourceId = string

/** Opaque identifier of a single record within a source. */
export type KnowledgeRecordId = string

/**
 * The kind of a knowledge source. The layer's purpose is to make the rest of the
 * platform agnostic to *which* of these a record came from — everything is
 * reached through the same {@link KnowledgeRepository} contract.
 */
export type KnowledgeSourceType = 'sql' | 'document' | 'vector' | 'cache' | 'api'
