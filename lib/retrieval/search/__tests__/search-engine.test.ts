/** Search engine tests: every searchX(), exact/partial/alias/fuzzy/unknown. */

import { describe, expect, it } from 'vitest'
import { makeEngine } from '@/lib/retrieval/__tests__/support'

const { engine } = makeEngine()

describe('SearchEngine', () => {
  it('searchCollege — prefix match and unknown', () => {
    const hit = engine.search.searchCollege('psg')
    expect(hit.total).toBe(1)
    expect(hit.matches[0].matchType).toBe('prefix')
    expect(engine.search.searchCollege('zzzzzz').total).toBe(0)
  })

  it('searchCollege — fuzzy misspelling', () => {
    expect(engine.search.searchCollege('kumaragru college of technlogy').total).toBeGreaterThan(0)
  })

  it('searchInstitution and searchFaculty', () => {
    expect(engine.search.searchInstitution('kumaraguru').total).toBe(1)
    expect(engine.search.searchFaculty('grace').matches[0].item.name).toBe('Grace Hopper')
  })

  it('searchBranch resolves via alias', () => {
    expect(engine.search.searchBranch('AI&DS').matches[0].matchType).toBe('alias')
  })

  it('searchPlacement / searchFinance / searchResearch attach summaries', () => {
    expect(engine.search.searchPlacement('psg').matches[0].item.placement?.medianSalary).toBe(800000)
    expect(engine.search.searchFinance('psg').matches[0].item.finance?.library).toBe(5000000)
    expect(engine.search.searchResearch('psg').matches[0].item.research?.sponsoredProjects).toBe(10)
  })

  it('returns a well-formed empty result for no matches', () => {
    const r = engine.search.searchCollege('qwertyuiop')
    expect(r).toEqual({ query: 'qwertyuiop', matches: [], total: 0 })
  })
})
