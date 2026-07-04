/** Branch retrieval tests: resolve, aliases, canonical, similar, unknown. */

import { describe, expect, it } from 'vitest'
import { makeEngine } from '@/lib/retrieval/__tests__/support'

const { engine } = makeEngine()

describe('BranchRetrievalService', () => {
  it('resolves aliases to the canonical branch', () => {
    expect(engine.branches.find('AI & DS')?.canonicalName).toBe(
      'Artificial Intelligence and Data Science',
    )
    expect(engine.branches.resolveAlias('AI&DS')?.canonicalName).toBe(
      'Artificial Intelligence and Data Science',
    )
    expect(engine.branches.find('Agriculture Engineering')?.canonicalName).toBe(
      'Agricultural Engineering',
    )
  })

  it('resolves curated abbreviations even when not observed in the data', () => {
    // 'CSE' never appears as a raw branch in the fixture, but the normalizer maps
    // it to the canonical name present in the catalog.
    expect(engine.branches.find('CSE')?.canonicalName).toBe('Computer Science and Engineering')
  })

  it('returns null for an unknown branch', () => {
    expect(engine.branches.find('Totally Unknown Branch')).toBeNull()
  })

  it('fetches a canonical branch by id', () => {
    const branch = engine.branches.find('AI&DS')!
    expect(engine.branches.getCanonical(branch.id)?.id).toBe(branch.id)
  })

  it('searches similar branch names', () => {
    const matches = engine.branches.searchSimilar('artificial intelligence')
    expect(matches[0]?.item.canonicalName.startsWith('Artificial Intelligence')).toBe(true)
  })
})
