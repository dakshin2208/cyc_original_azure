/**
 * @module lib/ai/query/__tests__/support
 *
 * Test doubles for the Query Understanding Layer: a fixed clock, a request
 * context, and fakes implementing each pipeline contract (classifier, extractor,
 * normalizer, validator). These prove the interfaces are coherent and
 * implementable; no real understanding logic lives here. Excluded from build.
 */

import {
  type AuthContext,
  type ClockPort,
  type RequestContext,
  sessionId,
  traceId,
  turnId,
} from '@/lib/ai/shared'
import type {
  EntityExtractionInput,
  EntityExtractionResult,
  EntityExtractor,
  IntentClassificationInput,
  IntentClassificationResult,
  IntentClassifier,
  QueryEntity,
  QueryIntentType,
  QueryNormalizer,
  QueryValidator,
  StructuredQuery,
  ValidationResult,
} from '@/lib/ai/query'

/** A clock frozen at a fixed instant. */
export class FixedClock implements ClockPort {
  constructor(private readonly iso = '2026-01-01T00:00:00.000Z') {}
  now(): Date {
    return new Date(this.iso)
  }
  isoNow(): string {
    return this.iso
  }
}

/** A minimal, valid request context for query calls. */
export function makeContext(): RequestContext {
  const auth: AuthContext = { userId: null, isAuthenticated: false, plan: 'freemium', roles: [] }
  return {
    userId: null,
    sessionId: sessionId('sess-test'),
    turnId: turnId('turn-test'),
    traceId: traceId('trace-test'),
    auth,
    startedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Build a simple numeric entity for tests. */
export function numericEntity(type: QueryEntity['type'], raw: string, n: number): QueryEntity<number> {
  return { type, value: raw, normalizedValue: n, confidence: 0.95, span: null }
}

/** A classifier that returns a fixed intent. */
export class FakeClassifier implements IntentClassifier {
  constructor(private readonly intentType: QueryIntentType = 'recommendation') {}
  async classify(
    _input: IntentClassificationInput,
    _context: RequestContext,
  ): Promise<IntentClassificationResult> {
    return { intent: { type: this.intentType, confidence: 0.9, alternatives: [] } }
  }
}

/** An extractor that returns a fixed entity list. */
export class FakeExtractor implements EntityExtractor {
  constructor(private readonly entities: readonly QueryEntity[] = []) {}
  async extract(
    _input: EntityExtractionInput,
    _context: RequestContext,
  ): Promise<EntityExtractionResult> {
    return { entities: this.entities }
  }
}

/** A normalizer that lowercases text and passes entities through. */
export class FakeNormalizer implements QueryNormalizer {
  normalizeText(text: string): string {
    return text.trim().toLowerCase()
  }
  async normalizeEntities(
    entities: readonly QueryEntity[],
    _context: RequestContext,
  ): Promise<readonly QueryEntity[]> {
    return entities
  }
}

/** A validator that always reports the query as valid. */
export class FakeValidator implements QueryValidator {
  validate(_query: StructuredQuery, _context: RequestContext): ValidationResult {
    return { state: 'valid', issues: [], valid: true }
  }
}
