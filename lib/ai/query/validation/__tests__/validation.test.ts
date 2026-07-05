/**
 * Validation model tests: issue/result shapes, the fake validator contract, and
 * the throwable QueryValidationError.
 */

import { describe, expect, it } from 'vitest'
import { QueryValidationError, type ValidationIssue } from '@/lib/ai/query'
import { FakeValidator, makeContext } from '@/lib/ai/query/__tests__/support'
import { createQueryFactory } from '@/lib/ai/query'
import { FixedClock } from '@/lib/ai/query/__tests__/support'

describe('QueryValidator contract', () => {
  it('reports a validation result for a structured query', () => {
    const query = createQueryFactory({ clock: new FixedClock() }).newBuilder('q').build()
    const result = new FakeValidator().validate(query, makeContext())
    expect(result.state).toBe('valid')
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })
})

describe('QueryValidationError', () => {
  it('carries issues and maps to the VALIDATION error code', () => {
    const issues: ValidationIssue[] = [
      { code: 'missing_required', severity: 'error', field: 'cutoff', message: 'cutoff is required' },
    ]
    const error = new QueryValidationError(issues)

    expect(error.code).toBe('VALIDATION')
    expect(error.issues).toEqual(issues)
    expect((error.detail as { issues: ValidationIssue[] }).issues).toHaveLength(1)
    // Serialized form is client-safe (no stack, no raw internals).
    expect(error.toJSON().code).toBe('VALIDATION')
  })
})
