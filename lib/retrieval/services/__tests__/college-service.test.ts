/** College retrieval tests: exact, partial, NIRF, fuzzy, counselling, unknown. */

import { describe, expect, it } from 'vitest'
import { counsellingCode, nirfId } from '@/lib/knowledge'
import { makeEngine } from '@/lib/retrieval/__tests__/support'

const { engine } = makeEngine()

describe('CollegeRetrievalService', () => {
  it('finds by exact name (case/format insensitive)', () => {
    expect(engine.colleges.findByExactName('PSG College of Technology')?.name).toBe(
      'PSG College of Technology',
    )
    expect(engine.colleges.findByExactName('psg college of technology')?.name).toBe(
      'PSG College of Technology',
    )
  })

  it('returns null for an unknown exact name', () => {
    expect(engine.colleges.findByExactName('Nonexistent College')).toBeNull()
  })

  it('finds by NIRF id', () => {
    expect(engine.colleges.findByNirfId(nirfId('IR-E-C-37013'))?.name).toBe(
      'PSG College of Technology',
    )
  })

  it('finds by partial name (ranked)', () => {
    const matches = engine.colleges.findByPartialName('college of technology')
    expect(matches).toHaveLength(2) // PSG + Kumaraguru
    expect(matches.every((m) => m.matchType === 'partial' || m.matchType === 'prefix')).toBe(true)
  })

  it('finds nearby matches for a misspelling (fuzzy)', () => {
    const matches = engine.colleges.findNearbyMatches('Kumaragru College of Technlogy')
    expect(matches[0]?.item.name).toBe('Kumaraguru College of Technology')
  })

  it('finds nearby matches for a partial misspelling (prefix-aware fuzzy)', () => {
    const matches = engine.colleges.findNearbyMatches('kumaragru college')
    expect(matches.some((m) => m.item.name === 'Kumaraguru College of Technology')).toBe(true)
  })

  it('returns null for a counselling code (no bridge in the sources yet)', () => {
    expect(engine.colleges.findByCounsellingCode(counsellingCode('1'))).toBeNull()
  })
})
