/**
 * @module lib/ai/query
 *
 * Public API of the Query Understanding Layer (Module 11). The rest of the AI
 * platform imports query-understanding types and the factory ONLY from here.
 *
 * This layer turns natural language into a canonical {@link StructuredQuery};
 * every downstream module consumes the structured query and never raw user text.
 */

// ── Intent (Module 1) ────────────────────────────────────────────────────────
export { QUERY_INTENT_TYPES } from './intent'
export type { QueryIntentType, IntentCandidate, ClassifiedIntent } from './intent'

// ── Entities (Module 2) ──────────────────────────────────────────────────────
export { ENTITY_TYPES } from './entities'
export type {
  EntityType,
  Gender,
  InstituteType,
  TextSpan,
  QueryEntity,
  CollegeEntity,
  CommunityEntity,
  GenderEntity,
  InstituteTypeEntity,
  NumericEntity,
  TextEntity,
} from './entities'

// ── Structured Query Model (Module 3) ────────────────────────────────────────
export { OUTPUT_KINDS } from './model'
export type {
  OutputKind,
  RequestedOutput,
  FilterOperator,
  QueryFilter,
  QueryConstraint,
  QueryPriority,
  ValidationState,
  QueryContext,
  StructuredQuery,
} from './model'

// ── Confidence (Module 9) ────────────────────────────────────────────────────
export type { IntentConfidence, EntityConfidence, QueryConfidence } from './confidence'

// ── Missing Information (Module 8) ───────────────────────────────────────────
export { MISSING_FIELD_KINDS } from './missing'
export type { MissingFieldKind, MissingField, MissingInformation } from './missing'

// ── Intent Classifier Contracts (Module 4) ───────────────────────────────────
export type {
  IntentClassificationInput,
  IntentClassificationResult,
  IntentClassifier,
} from './classification'

// ── Entity Extractor Contracts (Module 5) ────────────────────────────────────
export type {
  EntityExtractionInput,
  EntityExtractionResult,
  EntityExtractor,
} from './extraction'

// ── Normalizer Contracts (Module 7) ──────────────────────────────────────────
export type { AliasResolution, QueryNormalizer } from './normalization'

// ── Validation (Module 6) ────────────────────────────────────────────────────
export { VALIDATION_CODES, QueryValidationError } from './validation'
export type {
  ValidationSeverity,
  ValidationCode,
  ValidationIssue,
  ValidationResult,
  QueryValidator,
} from './validation'

// ── Factory / Builder / Understanding contract (Module 10) ───────────────────
export type { QueryDependencies, QueryFactory } from './factory'
export { QueryBuilder, createQueryBuilder, createQueryFactory } from './factory'
export type {
  RawQueryInput,
  QueryUnderstandingResult,
  QueryUnderstandingComponents,
  QueryUnderstanding,
} from './factory'
