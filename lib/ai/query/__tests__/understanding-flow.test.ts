/**
 * Composition test: demonstrates that the pipeline CONTRACTS interoperate to
 * produce a StructuredQuery. The composition lives in the TEST (not in source) —
 * this sprint implements no orchestrator. It proves the interfaces fit together
 * end-to-end for the canonical example "I got 182 cutoff. Which colleges?".
 */

import { describe, expect, it } from 'vitest'
import { createQueryFactory } from '@/lib/ai/query'
import {
  FakeClassifier,
  FakeExtractor,
  FakeNormalizer,
  FakeValidator,
  FixedClock,
  makeContext,
  numericEntity,
} from '@/lib/ai/query/__tests__/support'

describe('Query understanding — contract composition', () => {
  it('assembles a validated StructuredQuery from the pipeline contracts', async () => {
    const context = makeContext()
    const raw = 'I got 182 cutoff. Which colleges should I join?'

    // Each stage is an independent contract; the test wires them (no source orchestration).
    const classifier = new FakeClassifier('recommendation')
    const extractor = new FakeExtractor([numericEntity('cutoff', '182', 182)])
    const normalizer = new FakeNormalizer()
    const validator = new FakeValidator()
    const factory = createQueryFactory({ clock: new FixedClock() })

    const { intent } = await classifier.classify({ text: raw }, context)
    const { entities } = await extractor.extract({ text: raw, intent: intent.type }, context)
    const normalizedEntities = await normalizer.normalizeEntities(entities, context)
    const normalizedText = normalizer.normalizeText(raw)

    const query = factory
      .newBuilder(raw)
      .withIntent(intent)
      .withEntities(normalizedEntities)
      .withNormalizedQuery(normalizedText)
      .withRequestedOutput({ kind: 'opinion', description: null })
      .build()

    const validation = validator.validate(query, context)

    expect(query.intent.type).toBe('recommendation')
    expect(query.requestedOutput.kind).toBe('opinion')
    expect(query.entities[0]?.normalizedValue).toBe(182)
    expect(query.normalizedQuery).toBe(normalizedText)
    expect(query.originalQuery).toBe(raw)
    expect(validation.valid).toBe(true)
  })
})
