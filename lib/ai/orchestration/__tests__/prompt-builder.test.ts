/**
 * @module lib/ai/orchestration/__tests__/prompt-builder.test
 * PromptBuilder — anti-hallucination policy, serialization, provider-agnostic
 * message array, output contract. No LLM is called.
 */

import { describe, expect, it } from 'vitest'
import { makeHarness, NAME } from './support'

const { ai } = makeHarness()

describe('prompt builder', () => {
  it('embeds the anti-hallucination policy in the system prompt', () => {
    const { prompt } = ai.orchestrate('best college for placements')
    const sys = prompt.system.toLowerCase()
    expect(sys).toContain('only')
    expect(sys).toMatch(/never invent/)
    expect(sys).toMatch(/unavailable/)
    expect(sys).toMatch(/explain/)
  })

  it('exposes a provider-agnostic system+user message array', () => {
    const { prompt } = ai.orchestrate('best college for placements')
    expect(prompt.messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(prompt.messages[0].content).toContain('JSON') // output contract present
    expect(prompt.messages[1].content).toContain('USER QUESTION:')
  })

  it('serializes recommendations and citable evidence ids into the context', () => {
    const { prompt, context } = ai.orchestrate('best college for placements')
    expect(prompt.context).toContain('RECOMMENDATIONS')
    expect(prompt.context).toContain('EVIDENCE')
    // Every evidence id in the package appears in the serialized prompt.
    for (const item of context.evidence.items.slice(0, ai.config.maxEvidenceInPrompt)) {
      expect(prompt.context).toContain(item.id)
    }
  })

  it('renders unavailable values as UNAVAILABLE rather than inventing them', () => {
    const { prompt } = ai.orchestrate('what is the closing cutoff at psg college of technology')
    expect(prompt.context).toContain('UNAVAILABLE')
  })

  it('reports accurate metadata', () => {
    const { prompt, context } = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    expect(prompt.metadata.intent).toBe('compare_colleges')
    expect(prompt.metadata.hasComparison).toBe(true)
    expect(prompt.metadata.evidenceCount).toBe(context.evidence.count)
    expect(prompt.metadata.approxChars).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const a = ai.orchestrate('best college for placements').prompt
    const b = ai.orchestrate('best college for placements').prompt
    expect(a.messages).toEqual(b.messages)
  })
})
