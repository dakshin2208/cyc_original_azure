/** Canonical id-generation tests: determinism and name-based college ids. */

import { describe, expect, it } from 'vitest'
import { generateBranchId, generateCollegeId } from '@/lib/knowledge'

describe('generateCollegeId', () => {
  it('derives a deterministic name-based slug (nirf is not the identity)', () => {
    const id = generateCollegeId({ name: 'PSG College of Technology' })
    expect(id).toBe('col:psg-college-of-technology')
    expect(generateCollegeId({ name: 'PSG College of Technology' })).toBe(id)
  })

  it('distinguishes differently-named colleges', () => {
    expect(generateCollegeId({ name: 'A College' })).not.toBe(generateCollegeId({ name: 'B College' }))
  })
})

describe('generateBranchId', () => {
  it('is a deterministic slug of the canonical name', () => {
    expect(generateBranchId('Artificial Intelligence and Data Science')).toBe(
      'br:artificial-intelligence-and-data-science',
    )
  })
})
