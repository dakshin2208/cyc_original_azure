/**
 * Query builder & factory tests: defaults, immutability, accumulation, and
 * clock-stamped context from the injected dependencies.
 */

import { describe, expect, it } from 'vitest'
import { createQueryFactory } from '@/lib/ai/query'
import { FixedClock, numericEntity } from '@/lib/ai/query/__tests__/support'

const factory = createQueryFactory({ clock: new FixedClock() })

describe('QueryFactory / QueryBuilder', () => {
  it('produces a well-typed default structured query seeded with the original text', () => {
    const query = factory.newBuilder('I got 182 cutoff. Which colleges?').build()

    expect(query.originalQuery).toBe('I got 182 cutoff. Which colleges?')
    expect(query.normalizedQuery).toBe('I got 182 cutoff. Which colleges?')
    expect(query.intent.type).toBe('unknown')
    expect(query.requestedOutput.kind).toBe('unknown')
    expect(query.validationState).toBe('unvalidated')
    expect(query.priority).toBe('normal')
    expect(query.language).toBe('en')
    expect(query.context.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(query.missingInformation.complete).toBe(true)
  })

  it('is immutable — with* returns a new builder and does not mutate the original', () => {
    const base = factory.newBuilder('q')
    const high = base.withPriority('high')
    expect(base.build().priority).toBe('normal')
    expect(high.build().priority).toBe('high')
  })

  it('accumulates and replaces entities', () => {
    const e1 = numericEntity('cutoff', '182', 182)
    const e2 = numericEntity('year', '2026', 2026)
    const built = factory.newBuilder('q').addEntity(e1).addEntity(e2).build()
    expect(built.entities).toHaveLength(2)

    const replaced = factory.newBuilder('q').addEntity(e1).withEntities([e2]).build()
    expect(replaced.entities).toEqual([e2])
  })

  it('sets intent, requested output, confidence, and normalized query', () => {
    const query = factory
      .newBuilder('compare psg and kumaraguru')
      .withIntent({ type: 'comparison', confidence: 0.92, alternatives: [] })
      .withRequestedOutput({ kind: 'comparison', description: null })
      .withConfidence({ intent: 0.92, entities: 0.8, overall: 0.86, level: 'high' })
      .withNormalizedQuery('compare psg and kumaraguru')
      .withValidationState('valid')
      .build()

    expect(query.intent.type).toBe('comparison')
    expect(query.requestedOutput.kind).toBe('comparison')
    expect(query.confidence.level).toBe('high')
    expect(query.validationState).toBe('valid')
  })

  it('updates language and the context locale together', () => {
    const query = factory.newBuilder('q').withLanguage('ta').build()
    expect(query.language).toBe('ta')
    expect(query.context.locale).toBe('ta')
  })

  it('produces a frozen structured query', () => {
    const query = factory.newBuilder('q').build()
    expect(Object.isFrozen(query)).toBe(true)
  })
})
