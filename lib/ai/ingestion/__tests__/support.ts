/**
 * @module lib/ai/ingestion/__tests__/support
 *
 * Test doubles for the ingestion layer: a fixed clock, request context, model
 * builders, and fakes implementing each pipeline contract. Proves the interfaces
 * are coherent; no ingestion logic lives here. Excluded from build.
 */

import {
  type AuthContext,
  type ClockPort,
  type RequestContext,
  sessionId,
  traceId,
  turnId,
} from '@/lib/ai/shared'
import type { DocumentMetadata, DocumentType } from '@/lib/ai/knowledge'
import type {
  Chunk,
  ChunkValidation,
  ChunkingConfig,
  DocumentChunker,
  DocumentNormalizer,
  DocumentParser,
  DocumentValidation,
  KnowledgePreparationValidator,
  MetadataValidation,
  ParsedDocument,
  ParserRegistry,
  PreparationValidation,
  PreparedDocument,
  RawDocument,
} from '@/lib/ai/ingestion'
import { createChunkBuilder } from '@/lib/ai/ingestion'

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

/** A minimal, valid request context. */
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

const ISO = '2026-01-01T00:00:00.000Z'

/** Build document metadata (reused Sprint 3 model). */
export function makeMetadata(id: string): DocumentMetadata {
  return {
    sourceId: id,
    sourceType: 'document',
    version: '1.0.0',
    createdAt: ISO,
    updatedAt: ISO,
    checksum: 'abc123',
    owner: null,
    schema: null,
    confidence: null,
    language: 'en',
    sizeBytes: 100,
    documentType: 'text',
    mimeType: 'text/plain',
    title: `doc ${id}`,
    pageCount: null,
  }
}

/** Build a raw text document. */
export function makeRawDocument(id: string, text = 'hello world'): RawDocument {
  return {
    id,
    source: { kind: 'inline', uri: null, label: null },
    mimeType: 'text/plain',
    content: { kind: 'text', text },
    checksum: { algorithm: 'sha256', value: 'abc123' },
    sizeBytes: text.length,
    receivedAt: ISO,
  }
}

/** Build a parsed document. */
export function makeParsedDocument(id: string, text = 'hello world'): ParsedDocument {
  return {
    id,
    documentType: 'text',
    text,
    sections: [{ order: 0, title: null, text, page: null }],
    checksum: { algorithm: 'sha256', value: 'abc123' },
    parsedAt: ISO,
  }
}

/** Build a prepared document. */
export function makePreparedDocument(id: string, text = 'hello world'): PreparedDocument {
  return {
    id,
    documentType: 'text',
    normalizedText: text,
    sections: [{ order: 0, title: null, text, page: null }],
    metadata: makeMetadata(id),
    version: { version: '1.0.0', revision: 1, createdAt: ISO, supersedes: null },
    checksum: { algorithm: 'sha256', value: 'abc123' },
    preparedAt: ISO,
  }
}

/** A parser that handles text documents. */
export class FakeParser implements DocumentParser {
  readonly supportedTypes: readonly DocumentType[] = ['text']
  supports(documentType: DocumentType): boolean {
    return documentType === 'text'
  }
  async parse(raw: RawDocument, _context: RequestContext): Promise<ParsedDocument> {
    const text = raw.content.kind === 'text' ? raw.content.text : ''
    return makeParsedDocument(raw.id, text)
  }
}

/** A minimal in-memory parser registry. */
export class FakeParserRegistry implements ParserRegistry {
  private readonly parsers: DocumentParser[] = []
  register(parser: DocumentParser): void {
    this.parsers.push(parser)
  }
  resolve(documentType: DocumentType): DocumentParser | null {
    return this.parsers.find((p) => p.supports(documentType)) ?? null
  }
}

/** A normalizer that produces a prepared document. */
export class FakeNormalizer implements DocumentNormalizer {
  async normalize(parsed: ParsedDocument, _context: RequestContext): Promise<PreparedDocument> {
    return makePreparedDocument(parsed.id, parsed.text.trim())
  }
}

/** A chunker that emits a single chunk. */
export class FakeChunker implements DocumentChunker {
  async chunk(
    document: PreparedDocument,
    config: ChunkingConfig,
    _context: RequestContext,
  ): Promise<readonly Chunk[]> {
    return [
      createChunkBuilder(`${document.id}-0`, document.id, document.normalizedText, 0, config.strategy)
        .withTokenCount(2)
        .build(),
    ]
  }
}

/** A validator that always reports valid. */
export class FakeValidator implements KnowledgePreparationValidator {
  validateDocument(document: PreparedDocument, _context: RequestContext): DocumentValidation {
    return { scope: 'document', documentId: document.id, valid: true, issues: [] }
  }
  validateMetadata(metadata: DocumentMetadata, _context: RequestContext): MetadataValidation {
    return { scope: 'metadata', documentId: metadata.sourceId, valid: true, issues: [] }
  }
  validateChunk(chunk: Chunk, _context: RequestContext): ChunkValidation {
    return { scope: 'chunk', chunkId: chunk.id, valid: true, issues: [] }
  }
  validatePreparation(
    _document: PreparedDocument,
    _chunks: readonly Chunk[],
    _context: RequestContext,
  ): PreparationValidation {
    return { scope: 'preparation', valid: true, issues: [] }
  }
}
