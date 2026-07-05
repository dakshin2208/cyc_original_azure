/**
 * Composition test: demonstrates that the pipeline CONTRACTS interoperate to
 * prepare a document (parse → normalize → chunk → validate) and assemble a
 * PreparedKnowledge / PreparationResult. The composition lives in the TEST — this
 * sprint implements no pipeline orchestrator in source.
 */

import { describe, expect, it } from 'vitest'
import type {
  Chunk,
  PreparationResult,
  PreparedKnowledge,
} from '@/lib/ai/ingestion'
import {
  FakeChunker,
  FakeNormalizer,
  FakeParser,
  FakeParserRegistry,
  FakeValidator,
  makeContext,
  makeRawDocument,
} from '@/lib/ai/ingestion/__tests__/support'

describe('Ingestion pipeline — contract composition', () => {
  it('parses, normalizes, chunks, validates, and assembles PreparedKnowledge', async () => {
    const context = makeContext()
    const raw = makeRawDocument('d1', '  hello world  ')

    // Each stage is an independent contract; the test wires them (no source orchestration).
    const parsers = new FakeParserRegistry()
    parsers.register(new FakeParser())
    const parser = parsers.resolve('text')
    expect(parser).not.toBeNull()

    const parsed = await parser!.parse(raw, context)
    const prepared = await new FakeNormalizer().normalize(parsed, context)
    const chunks: readonly Chunk[] = await new FakeChunker().chunk(prepared, { strategy: 'paragraph', maxTokens: null, maxChars: 1000, overlap: 0 }, context)

    const validator = new FakeValidator()
    const documentValidation = validator.validateDocument(prepared, context)
    const chunkValidations = chunks.map((c) => validator.validateChunk(c, context))

    const knowledge: PreparedKnowledge = {
      document: prepared,
      chunks: {
        items: chunks,
        count: chunks.length,
        totalTokens: chunks.reduce((sum, c) => sum + c.metadata.tokenCount, 0),
      },
    }

    const result: PreparationResult = {
      knowledge,
      statistics: {
        documentsProcessed: 1,
        chunksProduced: chunks.length,
        totalTokens: knowledge.chunks.totalTokens,
        totalChars: prepared.normalizedText.length,
        durationMs: 0,
      },
      validation: {
        document: documentValidation,
        metadata: validator.validateMetadata(prepared.metadata, context),
        chunks: chunkValidations,
        overall: validator.validatePreparation(prepared, chunks, context),
      },
      errors: [],
      warnings: [],
      status: 'prepared',
    }

    expect(prepared.normalizedText).toBe('hello world') // trimmed by the fake normalizer
    expect(result.knowledge.chunks.count).toBe(1)
    expect(result.knowledge.chunks.items[0]?.text).toBe('hello world')
    expect(result.validation.overall.valid).toBe(true)
    expect(result.status).toBe('prepared')
  })
})
