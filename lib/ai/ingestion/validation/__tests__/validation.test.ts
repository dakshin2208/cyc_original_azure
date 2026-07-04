/**
 * Validation model & error tests: scoped validation outcomes and the ingestion
 * error hierarchy.
 */

import { describe, expect, it } from 'vitest'
import {
  DocumentParseError,
  DuplicateDocumentError,
  IngestionError,
  type PreparationIssue,
  UnsupportedDocumentTypeError,
} from '@/lib/ai/ingestion'
import {
  FakeValidator,
  makeContext,
  makeMetadata,
  makePreparedDocument,
} from '@/lib/ai/ingestion/__tests__/support'

describe('KnowledgePreparationValidator contract', () => {
  const validator = new FakeValidator()
  const context = makeContext()

  it('produces scoped validation outcomes', () => {
    const doc = makePreparedDocument('d1')
    expect(validator.validateDocument(doc, context).scope).toBe('document')
    expect(validator.validateMetadata(makeMetadata('d1'), context).scope).toBe('metadata')
    expect(validator.validatePreparation(doc, [], context).scope).toBe('preparation')
    expect(validator.validateDocument(doc, context).valid).toBe(true)
  })
})

describe('PreparationIssue model', () => {
  it('carries a code, severity, target, and message', () => {
    const issue: PreparationIssue = {
      code: 'empty_document',
      severity: 'error',
      target: 'd1',
      message: 'document has no content',
    }
    expect(issue.severity).toBe('error')
    expect(issue.code).toBe('empty_document')
  })
})

describe('Ingestion error hierarchy', () => {
  it('maps each error to the correct shared error code', () => {
    expect(new IngestionError('x').code).toBe('INTERNAL')
    expect(new DocumentParseError('x').code).toBe('VALIDATION')
    expect(new UnsupportedDocumentTypeError('x').code).toBe('VALIDATION')
    expect(new DuplicateDocumentError('x').code).toBe('CONFLICT')
    // client-safe serialization is inherited from AiError
    expect(new DocumentParseError('x').toJSON().code).toBe('VALIDATION')
  })
})
