/**
 * @module lib/ai/query/factory/query-builder
 *
 * An immutable builder that assembles a {@link StructuredQuery} from its parts
 * (Module 10). This is pure DTO assembly — it performs NO classification,
 * extraction, normalization, or validation. Each `with*` method returns a new
 * builder; `build()` returns a frozen structured query.
 */

import type { QueryConfidence } from '../confidence'
import type { QueryEntity } from '../entities'
import type { ClassifiedIntent } from '../intent'
import type { MissingInformation } from '../missing'
import type {
  QueryConstraint,
  QueryContext,
  QueryFilter,
  QueryPriority,
  RequestedOutput,
  StructuredQuery,
  ValidationState,
} from '../model'

/** Build a default, well-typed structured query seeded with the original text. */
function defaultQuery(originalQuery: string, createdAt: string): StructuredQuery {
  return {
    intent: { type: 'unknown', confidence: 0, alternatives: [] },
    entities: [],
    filters: [],
    constraints: [],
    requestedOutput: { kind: 'unknown', description: null },
    confidence: { intent: 0, entities: 0, overall: 0, level: 'low' },
    language: 'en',
    originalQuery,
    normalizedQuery: originalQuery,
    missingInformation: { fields: [], complete: true },
    context: { locale: 'en', createdAt, turnId: null },
    priority: 'normal',
    validationState: 'unvalidated',
  }
}

/**
 * Immutable builder for {@link StructuredQuery}. Construct via
 * {@link QueryBuilder.create} or the query factory; never mutate — chain `with*`
 * calls and finish with {@link QueryBuilder.build}.
 */
export class QueryBuilder {
  private constructor(private readonly draft: StructuredQuery) {}

  /** Create a builder seeded with the original query text and a creation time. */
  static create(originalQuery: string, createdAt: string): QueryBuilder {
    return new QueryBuilder(defaultQuery(originalQuery, createdAt))
  }

  private with(patch: Partial<StructuredQuery>): QueryBuilder {
    return new QueryBuilder({ ...this.draft, ...patch })
  }

  /** Set the classified intent. */
  withIntent(intent: ClassifiedIntent): QueryBuilder {
    return this.with({ intent })
  }

  /** Replace the entity list. */
  withEntities(entities: readonly QueryEntity[]): QueryBuilder {
    return this.with({ entities })
  }

  /** Append a single entity. */
  addEntity(entity: QueryEntity): QueryBuilder {
    return this.with({ entities: [...this.draft.entities, entity] })
  }

  /** Replace the filter list. */
  withFilters(filters: readonly QueryFilter[]): QueryBuilder {
    return this.with({ filters })
  }

  /** Replace the constraint list. */
  withConstraints(constraints: readonly QueryConstraint[]): QueryBuilder {
    return this.with({ constraints })
  }

  /** Set the requested output. */
  withRequestedOutput(requestedOutput: RequestedOutput): QueryBuilder {
    return this.with({ requestedOutput })
  }

  /** Set the composed confidence. */
  withConfidence(confidence: QueryConfidence): QueryBuilder {
    return this.with({ confidence })
  }

  /** Set the understood language (also updates the context locale). */
  withLanguage(language: string): QueryBuilder {
    return this.with({ language, context: { ...this.draft.context, locale: language } })
  }

  /** Set the normalized query text. */
  withNormalizedQuery(normalizedQuery: string): QueryBuilder {
    return this.with({ normalizedQuery })
  }

  /** Set the missing-information report. */
  withMissingInformation(missingInformation: MissingInformation): QueryBuilder {
    return this.with({ missingInformation })
  }

  /** Set the query context. */
  withContext(context: QueryContext): QueryBuilder {
    return this.with({ context })
  }

  /** Set the priority. */
  withPriority(priority: QueryPriority): QueryBuilder {
    return this.with({ priority })
  }

  /** Set the validation state. */
  withValidationState(validationState: ValidationState): QueryBuilder {
    return this.with({ validationState })
  }

  /** Produce the immutable {@link StructuredQuery}. */
  build(): StructuredQuery {
    return Object.freeze({ ...this.draft })
  }
}

/** Create a {@link QueryBuilder} seeded with the original text and creation time. */
export function createQueryBuilder(originalQuery: string, createdAt: string): QueryBuilder {
  return QueryBuilder.create(originalQuery, createdAt)
}
