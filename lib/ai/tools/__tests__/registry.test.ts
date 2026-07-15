/**
 * @module lib/ai/tools/__tests__/registry
 *
 * Commit 3 — the generic Tool Registry. Proves: every first-wave tool is registered;
 * dispatch is by NAME only (no conditionals); each tool maps args → the neutral
 * ToolResult; unknown tools and incomplete args decline (null).
 */

import { describe, expect, it } from 'vitest'
import { createDefaultToolRegistry, createToolRegistry, type Tool } from '..'

const registry = createDefaultToolRegistry()

describe('tool registry — dispatch by name, no conditionals', () => {
  it('registers every first-wave capability', () => {
    for (const name of [
      'recommend_by_cutoff',
      'recommend_best_college',
      'recommend_by_branch',
      'compare_colleges',
      'college_details',
      'placement_query',
      'ranking_query',
      'branch_guidance',
      'college_listing',
      'profile_tools',
    ]) {
      expect(registry.has(name)).toBe(true)
    }
    expect(registry.list().length).toBe(10)
  })

  it('recommend_by_cutoff → a recommend result when cutoff + community are present', () => {
    const r = registry.execute('recommend_by_cutoff', { cutoff: 178, community: 'bc', district: 'Coimbatore' })
    expect(r).toEqual({ kind: 'recommend', args: { cutoff: 178, community: 'BC', district: 'Coimbatore' } })
  })

  it('recommend_by_cutoff → null (declines) when community is missing', () => {
    expect(registry.execute('recommend_by_cutoff', { cutoff: 178 })).toBeNull()
  })

  it('compare_colleges → a route result naming both colleges', () => {
    expect(registry.execute('compare_colleges', { colleges: ['PSG', 'CIT'] })).toEqual({
      kind: 'route',
      message: 'compare PSG and CIT',
      needsCollege: true,
    })
  })

  it('compare_colleges → null with fewer than two colleges', () => {
    expect(registry.execute('compare_colleges', { colleges: ['PSG'] })).toBeNull()
  })

  it('placement_query → a college route or an overall route', () => {
    expect(registry.execute('placement_query', { college: 'PSG' })).toEqual({
      kind: 'route',
      message: 'what are the placements at PSG',
      needsCollege: true,
    })
    expect(registry.execute('placement_query', {})).toEqual({
      kind: 'route',
      message: 'which colleges have the best placements',
      needsCollege: false,
    })
  })

  it('college_listing → a list result with a default count', () => {
    expect(registry.execute('college_listing', { city: 'Chennai' })).toEqual({
      kind: 'list',
      city: 'Chennai',
      count: 10,
      branch: null,
    })
  })

  it('profile_tools → a recommend result from the provided slots', () => {
    expect(registry.execute('profile_tools', { cutoff: 190, community: 'OC' })).toEqual({
      kind: 'recommend',
      args: { cutoff: 190, community: 'OC' },
    })
  })

  it('an unknown tool → null (no throw, no special-casing)', () => {
    expect(registry.execute('do_magic', { anything: true })).toBeNull()
  })

  it('is extensible by registration alone (no orchestration change)', () => {
    const custom: Tool = {
      name: 'my_tool',
      description: 'test',
      parameters: {},
      execute: () => ({ kind: 'route', message: 'hello', needsCollege: false }),
    }
    const r = createToolRegistry().register(custom)
    expect(r.has('my_tool')).toBe(true)
    expect(r.execute('my_tool', {})).toEqual({ kind: 'route', message: 'hello', needsCollege: false })
  })
})
