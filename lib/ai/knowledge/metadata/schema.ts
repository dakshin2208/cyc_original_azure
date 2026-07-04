/**
 * @module lib/ai/knowledge/metadata/schema
 *
 * Schema descriptor models — a structural description of the shape of a source's
 * records. Metadata only; extraction/introspection is out of scope for this
 * layer.
 */

/** The logical type of a schema field. */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'unknown'

/** A single field within a {@link SchemaDescriptor}. */
export interface SchemaField {
  /** Field name. */
  readonly name: string
  /** Logical type. */
  readonly type: FieldType
  /** Whether the field may be null/absent. */
  readonly nullable: boolean
  /** Optional human-readable description. */
  readonly description?: string
}

/** A versioned description of a source's record shape. */
export interface SchemaDescriptor {
  /** Schema name. */
  readonly name: string
  /** Schema version (e.g. semantic version or date). */
  readonly version: string
  /** The fields comprising the schema. */
  readonly fields: readonly SchemaField[]
}
