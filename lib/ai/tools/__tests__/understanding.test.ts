/**
 * @module lib/ai/tools/__tests__/understanding
 *
 * Production-safe migration — proves the LLM understanding is the PRIMARY path and
 * that EVERY documented failure mode returns null (→ the coordinator's deterministic
 * FALLBACK) with the correct observed reason: timeout, malformed, empty, unsupported,
 * error. A valid plan reports path 'llm'. Never throws.
 */

import { describe, expect, it } from 'vitest'
import { createFunctionProvider, createStaticProvider, type LLMProvider } from '@/lib/ai/llm'
import { createToolUnderstanding, type OrchestrationOutcome } from '..'

function record() {
  const outcomes: Array<{ id: string; outcome: OrchestrationOutcome }> = []
  return { outcomes, onOutcome: (id: string, outcome: OrchestrationOutcome) => outcomes.push({ id, outcome }) }
}

const hangingProvider = (): LLMProvider =>
  createFunctionProvider('openai', () => new Promise(() => undefined)) // never resolves

const throwingProvider = (): LLMProvider =>
  createFunctionProvider('openai', () => {
    throw new Error('provider down')
  })

describe('createToolUnderstanding — LLM primary, deterministic fallback', () => {
  it('valid plan → ToolResult + path "llm"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(
      createStaticProvider('p', '{"calls":[{"tool":"recommend_by_cutoff","arguments":{"cutoff":178,"community":"BC"}}]}'),
      { onOutcome },
    )
    const result = await understand('which colleges can I get?', 'c1')
    expect(result).toEqual({ kind: 'recommend', args: { cutoff: 178, community: 'BC' } })
    expect(outcomes).toEqual([{ id: 'c1', outcome: { path: 'llm', reason: null } }])
  })

  it('malformed JSON → null + reason "malformed"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(createStaticProvider('p', 'sorry I cannot help'), { onOutcome })
    expect(await understand('x', 'c2')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'malformed' })
  })

  it('empty plan → null + reason "empty"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(createStaticProvider('p', '{"calls":[]}'), { onOutcome })
    expect(await understand('x', 'c3')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'empty' })
  })

  it('unsupported / non-actionable tool → null + reason "unsupported"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(createStaticProvider('p', '{"calls":[{"tool":"do_magic","arguments":{}}]}'), { onOutcome })
    expect(await understand('x', 'c4')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'unsupported' })
  })

  it('LLM timeout → null + reason "timeout"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(hangingProvider(), { onOutcome, timeoutMs: 20 })
    expect(await understand('x', 'c5')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'timeout' })
  })

  it('provider error → null + reason "error"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(throwingProvider(), { onOutcome, timeoutMs: 100 })
    expect(await understand('x', 'c6')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'error' })
  })

  it('a declined tool (recommend_by_cutoff without community) → null + "unsupported"', async () => {
    const { outcomes, onOutcome } = record()
    const understand = createToolUnderstanding(
      createStaticProvider('p', '{"calls":[{"tool":"recommend_by_cutoff","arguments":{"cutoff":150}}]}'),
      { onOutcome },
    )
    expect(await understand('cutoff 150', 'c7')).toBeNull()
    expect(outcomes[0].outcome).toEqual({ path: 'deterministic_fallback', reason: 'unsupported' })
  })
})
