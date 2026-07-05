/**
 * @module lib/recommendation/__tests__/normalizers.test
 * Pure numeric normalizers (Module 2 primitives).
 */

import { describe, expect, it } from 'vitest'
import { blend, clamp01, normalizeToRef, ratio } from '@/lib/recommendation'

describe('normalizers', () => {
  it('clamp01 bounds to [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1.5)).toBe(1)
  })

  it('ratio guards against zero/negative/absent denominators', () => {
    expect(ratio(1, 4)).toBe(0.25)
    expect(ratio(1, 0)).toBeNull()
    expect(ratio(1, -2)).toBeNull()
    expect(ratio(null, 4)).toBeNull()
    expect(ratio(2, null)).toBeNull()
  })

  it('normalizeToRef maps value/ref into [0, 1]', () => {
    expect(normalizeToRef(600_000, 1_200_000)).toBe(0.5)
    expect(normalizeToRef(2_400_000, 1_200_000)).toBe(1) // clamped
    expect(normalizeToRef(null, 1_200_000)).toBeNull()
    expect(normalizeToRef(10, 0)).toBeNull() // invalid ref
  })

  it('blend averages only the present values', () => {
    expect(blend([0.2, 0.4])).toBeCloseTo(0.3, 10)
    expect(blend([0.2, null, 0.8])).toBeCloseTo(0.5, 10)
    expect(blend([null, null])).toBeNull()
    expect(blend([])).toBeNull()
  })
})
