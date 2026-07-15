/**
 * @module lib/ai/tools/__tests__/tool-plan
 *
 * Commit 3 — the ToolPlan schema `{ calls: [] }` and the generic executor. Proves:
 * single and MULTIPLE tool calls parse; the executor runs calls in order and returns
 * the first that resolves; empty / malformed plans decline.
 */

import { describe, expect, it } from 'vitest'
import { createDefaultToolRegistry, executePlan, parseToolPlan } from '..'

const registry = createDefaultToolRegistry()

describe('parseToolPlan — the { calls: [] } schema', () => {
  it('parses a single call', () => {
    const r = parseToolPlan('{"calls":[{"tool":"ranking_query","arguments":{}}]}')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.calls).toEqual([{ tool: 'ranking_query', arguments: {} }])
  })

  it('parses MULTIPLE calls (multi-tool plan)', () => {
    const r = parseToolPlan(
      '{"calls":[{"tool":"recommend_by_cutoff","arguments":{"cutoff":178,"community":"BC"}},{"tool":"placement_query","arguments":{}}]}',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.calls.length).toBe(2)
    expect(r.plan.calls.map((c) => c.tool)).toEqual(['recommend_by_cutoff', 'placement_query'])
  })

  it('parses a fenced JSON block', () => {
    const r = parseToolPlan('```json\n{"calls":[{"tool":"ranking_query","arguments":{}}]}\n```')
    expect(r.ok).toBe(true)
  })

  it('accepts an empty calls array (→ deterministic fallback)', () => {
    const r = parseToolPlan('{"calls":[]}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plan.calls).toEqual([])
  })

  it('skips malformed calls (non-string tool)', () => {
    const r = parseToolPlan('{"calls":[{"tool":123,"arguments":{}},{"tool":"ranking_query","arguments":{}}]}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plan.calls.map((c) => c.tool)).toEqual(['ranking_query'])
  })

  it('rejects a non-object / missing calls', () => {
    expect(parseToolPlan('"nope"').ok).toBe(false)
    expect(parseToolPlan('{"tool":"x"}').ok).toBe(false)
  })
})

describe('executePlan — generic execution over the registry', () => {
  it('runs a single call and returns its result', () => {
    const plan = parseToolPlan('{"calls":[{"tool":"ranking_query","arguments":{}}]}')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(executePlan(plan.plan, registry)).toEqual({
      kind: 'route',
      message: 'which are the best colleges overall',
      needsCollege: false,
    })
  })

  it('runs calls in order and returns the FIRST that resolves', () => {
    // First call is unknown (→ null), so the executor falls through to the second.
    const plan = parseToolPlan(
      '{"calls":[{"tool":"unknown_tool","arguments":{}},{"tool":"compare_colleges","arguments":{"colleges":["PSG","CIT"]}}]}',
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(executePlan(plan.plan, registry)).toEqual({
      kind: 'route',
      message: 'compare PSG and CIT',
      needsCollege: true,
    })
  })

  it('returns null when no call resolves (→ deterministic fallback)', () => {
    const plan = parseToolPlan('{"calls":[{"tool":"unknown_tool","arguments":{}}]}')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(executePlan(plan.plan, registry)).toBeNull()
  })

  it('returns null for an empty plan', () => {
    expect(executePlan({ calls: [] }, registry)).toBeNull()
  })
})
