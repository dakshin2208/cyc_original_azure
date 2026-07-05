/**
 * @module lib/ai/llm/__tests__/integration.test
 *
 * Sprint 4 → Sprint 5 end-to-end: a real question is orchestrated into a
 * prompt + context, a provider double generates a reply, and the adapter parses,
 * validates, and guards it into a safe final response. Confirms the whole
 * pipeline holds the anti-hallucination contract.
 */

import { describe, expect, it } from 'vitest'
import { createLLMAdapter } from '@/lib/ai/llm'
import { ask, goodReply, jsonProvider, NAME } from './support'

describe('orchestrator → adapter pipeline', () => {
  it('produces a validated answer whose citations reference real evidence', async () => {
    const scenario = ask(`compare ${NAME.psg} and ${NAME.anna}`)
    const adapter = createLLMAdapter(jsonProvider(goodReply(scenario.context)))
    const result = await adapter.respond(scenario.prompt, scenario.context)

    expect(result.status).toBe('ok')
    const validIds = new Set(scenario.context.evidence.items.map((e) => e.id))
    for (const c of result.response.citations) expect(validIds.has(c.evidenceId)).toBe(true)
  })

  it('strips an invented college that the model slipped into prose', async () => {
    const scenario = ask(`what are the placements at ${NAME.psg}`)
    const ev = scenario.context.evidence.items[0]
    const reply = {
      answer: `${NAME.psg} has strong placements. Hogwarts Institute of Technology is even better.`,
      citations: [{ evidenceId: ev.id, collegeName: ev.collegeName, label: ev.label, source: ev.source }],
      confidence: 'high',
    }
    const result = await createLLMAdapter(jsonProvider(reply)).respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('repaired')
    expect(result.response.answer).not.toMatch(/hogwarts/i)
    expect(result.response.answer).toContain(NAME.psg)
  })

  it('degrades to a safe fallback (no invention) when the model is unusable', async () => {
    const scenario = ask(`recommend the best college`)
    const result = await createLLMAdapter(jsonProvider('garbage-not-object')).respond(scenario.prompt, scenario.context)
    expect(['unparseable', 'rejected', 'provider_error']).toContain(result.status)
    expect(result.response.confidence).toBe('low')
  })

  it('is deterministic end-to-end', async () => {
    const scenario = ask(`compare ${NAME.psg} and ${NAME.anna}`)
    const provider = jsonProvider(goodReply(scenario.context))
    const a = await createLLMAdapter(provider).respond(scenario.prompt, scenario.context)
    const b = await createLLMAdapter(provider).respond(scenario.prompt, scenario.context)
    expect(a.response).toEqual(b.response)
  })
})
