/**
 * @module lib/ai/llm/__tests__/adapter.test
 * Adapter pipeline — ok, repaired, retry, and the three fallback paths.
 */

import { describe, expect, it } from 'vitest'
import {
  createLLMAdapter,
  createUnavailableProvider,
  isModelAuthored,
} from '@/lib/ai/llm'
import { ask, countingProvider, goodReply, jsonProvider, NAME, sequenceProvider } from './support'

const scenario = ask(`what are the placements at ${NAME.psg}`)
const ev = scenario.context.evidence.items[0]

describe('adapter — success paths', () => {
  it('returns ok for a valid, fully-supported reply on the first attempt', async () => {
    const adapter = createLLMAdapter(jsonProvider(goodReply(scenario.context)))
    const result = await adapter.respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('ok')
    expect(result.attempts).toBe(1)
    expect(isModelAuthored(result)).toBe(true)
    expect(result.response.answer.length).toBeGreaterThan(0)
  })

  it('repairs a reply that includes an unsupported figure (guard removes it)', async () => {
    const reply = {
      answer: `${NAME.psg} is a strong choice. Its median salary is 7777777 rupees.`,
      citations: [{ evidenceId: ev.id, collegeName: ev.collegeName, label: ev.label, source: ev.source }],
      followUps: [],
      confidence: 'high',
      hadMissingInformation: false,
    }
    const result = await createLLMAdapter(jsonProvider(reply)).respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('repaired')
    expect(result.response.answer).not.toContain('7777777')
    expect(result.issues.some((i) => i.code === 'fabricated_figure')).toBe(true)
  })

  it('retries once after an unparseable reply, then succeeds', async () => {
    const provider = sequenceProvider(['not json at all', JSON.stringify(goodReply(scenario.context))])
    const result = await createLLMAdapter(provider).respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('ok')
    expect(result.attempts).toBe(2)
  })

  it('makes exactly maxAttempts provider calls before giving up', async () => {
    const { provider, calls } = countingProvider(() => 'still not json')
    const result = await createLLMAdapter(provider, { maxAttempts: 2 }).respond(scenario.prompt, scenario.context)
    expect(calls()).toBe(2)
    expect(result.status).toBe('unparseable')
  })
})

describe('adapter — fallback paths (never throws, always safe)', () => {
  it('falls back deterministically when the reply cannot be parsed', async () => {
    const result = await createLLMAdapter(jsonProvider('this is not the shape'), {}).respond(scenario.prompt, scenario.context)
    // jsonProvider serializes a string → valid JSON string, not an object → parse fails.
    expect(result.status).toBe('unparseable')
    expect(result.response.confidence).toBe('low')
    expect(isModelAuthored(result)).toBe(false)
  })

  it('rejects and falls back when the reply cites fabricated evidence', async () => {
    const reply = {
      answer: 'Trust me.',
      citations: [{ evidenceId: 'totally-made-up', collegeName: null, label: 'x', source: 'retrieval' }],
      confidence: 'high',
    }
    const result = await createLLMAdapter(jsonProvider(reply)).respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('rejected')
    expect(result.issues.some((i) => i.code === 'unknown_citation')).toBe(true)
  })

  it('falls back when the provider itself fails', async () => {
    const result = await createLLMAdapter(createUnavailableProvider('down')).respond(scenario.prompt, scenario.context)
    expect(result.status).toBe('provider_error')
    expect(result.raw).toBeNull()
    expect(result.response.answer.length).toBeGreaterThan(0)
  })

  it('the fallback surfaces the context follow-up questions', async () => {
    const eligibility = ask('am i eligible for a good college')
    const result = await createLLMAdapter(createUnavailableProvider('down')).respond(eligibility.prompt, eligibility.context)
    expect(result.status).toBe('provider_error')
    expect(result.response.followUps.length).toBeGreaterThan(0)
    expect(result.response.answer).toContain(eligibility.context.followUpQuestions[0].question)
  })

  it('is deterministic', async () => {
    const a = await createLLMAdapter(jsonProvider(goodReply(scenario.context))).respond(scenario.prompt, scenario.context)
    const b = await createLLMAdapter(jsonProvider(goodReply(scenario.context))).respond(scenario.prompt, scenario.context)
    expect(a.status).toBe(b.status)
    expect(a.response.answer).toBe(b.response.answer)
  })
})
