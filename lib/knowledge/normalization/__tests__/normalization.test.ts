/** Normalization tests: branch aliases (incl. the required examples), community, college. */

import { describe, expect, it } from 'vitest'
import { normalizeBranch, normalizeCollegeName, normalizeCommunity, slugify } from '@/lib/knowledge'

describe('normalizeBranch', () => {
  it('maps AI&DS to the canonical name (required example)', () => {
    const r = normalizeBranch('AI&DS')
    expect(r.canonicalName).toBe('Artificial Intelligence and Data Science')
    expect(r.matched).toBe(true)
  })

  it('unifies AI&DS and its full spelling to one canonical name', () => {
    expect(normalizeBranch('AI & DS').canonicalName).toBe(
      normalizeBranch('Artificial Intelligence and Data Science').canonicalName,
    )
  })

  it('maps Agriculture Engineering to Agricultural Engineering (required example)', () => {
    expect(normalizeBranch('Agriculture Engineering').canonicalName).toBe('Agricultural Engineering')
  })

  it('ignores self-support (SS) suffixes when matching', () => {
    expect(normalizeBranch('COMPUTER SCIENCE AND ENGINEERING (SS)').canonicalName).toBe(
      'Computer Science and Engineering',
    )
  })

  it('falls back to a cleaned title-cased name for unknown branches', () => {
    const r = normalizeBranch('QUANTUM WIDGET ENGINEERING')
    expect(r.matched).toBe(false)
    expect(r.canonicalName).toBe('Quantum Widget Engineering')
  })
})

describe('normalizeCommunity', () => {
  it('normalizes known community labels case-insensitively', () => {
    expect(normalizeCommunity('oc')).toBe('OC')
    expect(normalizeCommunity('General')).toBe('OC')
    expect(normalizeCommunity('SCA')).toBe('SCA')
  })
  it('returns null for unknown communities', () => {
    expect(normalizeCommunity('XYZ')).toBeNull()
  })
})

describe('normalizeCollegeName', () => {
  it('strips embedded NIRF codes and derives a slug', () => {
    const r = normalizeCollegeName('PSG College of Technology [IR-E-C-37013]')
    expect(r.name).toBe('PSG College of Technology')
    expect(r.slug).toBe('psg-college-of-technology')
  })
})

describe('slugify', () => {
  it('produces deterministic, url-safe slugs and expands &', () => {
    expect(slugify('Artificial Intelligence & Data Science (SS)')).toBe(
      'artificial-intelligence-and-data-science-ss',
    )
  })
})
