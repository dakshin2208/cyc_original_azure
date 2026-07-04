/**
 * Ingestion factory & builder tests: DI, chunk builder, request builder,
 * defaults, and immutability.
 */

import { describe, expect, it } from 'vitest'
import {
  createIngestionFactory,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_PREPARATION_OPTIONS,
} from '@/lib/ai/ingestion'
import { FixedClock, makeRawDocument } from '@/lib/ai/ingestion/__tests__/support'

const factory = createIngestionFactory({ clock: new FixedClock() })

describe('IngestionFactory / IngestionRequestBuilder', () => {
  it('builds a default request from a raw document (DI clock-stamped)', () => {
    const request = factory.newRequestBuilder(makeRawDocument('d1')).build()
    expect(request.document.id).toBe('d1')
    expect(request.chunking).toEqual(DEFAULT_CHUNKING_CONFIG)
    expect(request.options).toEqual(DEFAULT_PREPARATION_OPTIONS)
    expect(request.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('is immutable — with* returns a new builder', () => {
    const base = factory.newRequestBuilder(makeRawDocument('d1'))
    const custom = base.withChunking({ strategy: 'fixed', maxTokens: 256, maxChars: null, overlap: 0 })
    expect(base.build().chunking.strategy).toBe('paragraph')
    expect(custom.build().chunking.strategy).toBe('fixed')
    expect(custom.build().chunking.maxTokens).toBe(256)
  })

  it('applies preparation options', () => {
    const request = factory
      .newRequestBuilder(makeRawDocument('d1'))
      .withOptions({ detectDuplicates: false, failOnValidationError: true })
      .build()
    expect(request.options).toEqual({ detectDuplicates: false, failOnValidationError: true })
    expect(Object.isFrozen(request)).toBe(true)
  })
})

describe('ChunkBuilder', () => {
  it('derives character count and defaults, and sets metadata immutably', () => {
    const base = factory.newChunkBuilder('c0', 'd1', 'hello', 0, 'paragraph')
    const chunk = base.withTokenCount(1).withSourcePage(3).withSection('intro').withLanguage('en').build()

    expect(chunk.id).toBe('c0')
    expect(chunk.documentId).toBe('d1')
    expect(chunk.strategy).toBe('paragraph')
    expect(chunk.metadata.charCount).toBe(5)
    expect(chunk.metadata.tokenCount).toBe(1)
    expect(chunk.metadata.sourcePage).toBe(3)
    expect(chunk.metadata.section).toBe('intro')
    expect(chunk.metadata.language).toBe('en')
    // original builder unaffected
    expect(base.build().metadata.tokenCount).toBe(0)
  })

  it('recomputes character count on withText and freezes the result', () => {
    const chunk = factory.newChunkBuilder('c0', 'd1', 'hi', 0, 'fixed').withText('longer text').build()
    expect(chunk.metadata.charCount).toBe('longer text'.length)
    expect(Object.isFrozen(chunk)).toBe(true)
    expect(Object.isFrozen(chunk.metadata)).toBe(true)
  })
})
