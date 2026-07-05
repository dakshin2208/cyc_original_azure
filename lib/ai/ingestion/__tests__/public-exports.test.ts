/**
 * Public API tests: the ingestion layer's runtime exports are reachable from the
 * single public barrel and carry expected values.
 */

import { describe, expect, it } from 'vitest'
import {
  CHUNK_STRATEGIES,
  CHECKSUM_ALGORITHMS,
  PREPARATION_ISSUE_CODES,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_PREPARATION_OPTIONS,
  ChunkBuilder,
  IngestionRequestBuilder,
  createChunkBuilder,
  createIngestionRequestBuilder,
  createIngestionFactory,
} from '@/lib/ai/ingestion'

describe('lib/ai/ingestion public API', () => {
  it('exports the chunk strategy vocabulary (with reserved semantic)', () => {
    expect(CHUNK_STRATEGIES).toContain('fixed')
    expect(CHUNK_STRATEGIES).toContain('paragraph')
    expect(CHUNK_STRATEGIES).toContain('sliding_window')
    expect(CHUNK_STRATEGIES).toContain('semantic')
  })

  it('exports checksum algorithms and issue codes', () => {
    expect(CHECKSUM_ALGORITHMS).toContain('sha256')
    expect(PREPARATION_ISSUE_CODES).toContain('parse_failed')
    expect(PREPARATION_ISSUE_CODES).toContain('duplicate_document')
  })

  it('exports well-formed defaults', () => {
    expect(DEFAULT_CHUNKING_CONFIG.strategy).toBe('paragraph')
    expect(DEFAULT_PREPARATION_OPTIONS.detectDuplicates).toBe(true)
  })

  it('exports builder and factory constructors', () => {
    expect(typeof createIngestionFactory).toBe('function')
    expect(typeof createChunkBuilder).toBe('function')
    expect(typeof createIngestionRequestBuilder).toBe('function')
    expect(typeof ChunkBuilder.create).toBe('function')
    expect(typeof IngestionRequestBuilder.create).toBe('function')
  })
})
