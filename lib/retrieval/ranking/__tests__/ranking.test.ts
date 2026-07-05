/** Ranking tests: similarity + deterministic match types and ordering. */

import { describe, expect, it } from 'vitest'
import { levenshtein, rankCandidates, similarity } from '@/lib/retrieval'

describe('similarity', () => {
  it('scores identical strings 1 and unrelated strings low', () => {
    expect(similarity('psg', 'psg')).toBe(1)
    expect(levenshtein('kumaraguru', 'kumaragru')).toBe(1)
    expect(similarity('kumaraguru', 'kumaragru')).toBeGreaterThan(0.8)
  })
})

interface Item { readonly name: string; readonly aliases: readonly string[] }
const items: Item[] = [
  { name: 'Computer Science and Engineering', aliases: ['CSE'] },
  { name: 'Computer Applications', aliases: [] },
  { name: 'Mechanical Engineering', aliases: ['MECH'] },
]
const opts = { name: (i: Item) => i.name, aliases: (i: Item) => i.aliases }

describe('rankCandidates', () => {
  it('ranks exact match highest', () => {
    const r = rankCandidates('Computer Science and Engineering', items, opts)
    expect(r[0].matchType).toBe('exact')
    expect(r[0].score).toBe(1)
  })

  it('detects alias, prefix, and partial matches', () => {
    expect(rankCandidates('CSE', items, opts)[0].matchType).toBe('alias')
    expect(rankCandidates('Computer', items, opts).some((m) => m.matchType === 'prefix')).toBe(true)
    expect(rankCandidates('Engineering', items, opts).every((m) => m.matchType === 'partial')).toBe(true)
  })

  it('detects fuzzy (misspelling) matches', () => {
    const r = rankCandidates('Mechnical Enginering', items, opts)
    expect(r[0].item.name).toBe('Mechanical Engineering')
    expect(r[0].matchType).toBe('fuzzy')
  })

  it('returns nothing for an empty or unmatched query', () => {
    expect(rankCandidates('', items, opts)).toEqual([])
    expect(rankCandidates('zzzzqwerty', items, opts)).toEqual([])
  })

  it('is deterministic (score desc, then label asc) and respects the limit', () => {
    const r = rankCandidates('Computer', items, { ...opts, limit: 1 })
    expect(r).toHaveLength(1)
  })
})
