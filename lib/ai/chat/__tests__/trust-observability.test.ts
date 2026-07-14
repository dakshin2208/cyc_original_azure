/**
 * @module lib/ai/chat/__tests__/trust-observability.test
 *
 * "Is the hallucination guard firing on live traffic?" must be a COUNTABLE number.
 *
 * Before this, it wasn't. The validator computed exactly why the model's prose was rejected,
 * and the guard recorded exactly which sentences it stripped — and both were thrown away at
 * `const usedModel = validation.ok`. Worse, a REPAIRED answer (the guard removed ungrounded
 * sentences and shipped the rest) still reports `usedModel: true`. So a model hallucinating on
 * every single turn, saved every time by the guard, produced metrics indistinguishable from a
 * perfectly clean one.
 *
 * These tests pin the three signals now on `trust_outcome`, and — just as importantly — pin the
 * PRIVACY boundary: the validator's and guard's human-readable MESSAGES embed model prose (a
 * stripped sentence, a cited college name), so only closed-enum CODES and a COUNT are emitted.
 * A code is countable; a sentence is a leak.
 */

import { describe, expect, it } from 'vitest'
import { createFunctionProvider, type CompletionRequest } from '@/lib/ai/llm'
import { DISCARD_CODES } from '@/lib/opinion'
import {
  buildCounselorChatService,
  createNullLogger,
  createRecordingAnalytics,
  type AnalyticsEvent,
  type ChatResponse,
} from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

/** The prompt shows evidence as "  [<id>] <label> = <value> (source, confidence)". */
const firstEvidenceId = (req: CompletionRequest): string | null => {
  const prompt = req.messages.map((m) => m.content).join('\n')
  return /^\s*\[([^\]]+)\]/m.exec(prompt)?.[1] ?? null
}

/** A stub "model" that returns whatever JSON we tell it to, given the real prompt. */
const modelSaying = (build: (evidenceId: string | null) => object) =>
  createFunctionProvider('stub', (req) => ({
    text: JSON.stringify(build(firstEvidenceId(req))),
    model: 'stub',
    finishReason: 'stop',
  }))

const trustEvent = (events: readonly AnalyticsEvent[]) =>
  events.find((e) => e.type === 'trust_outcome') as
    | Extract<AnalyticsEvent, { type: 'trust_outcome' }>
    | undefined

describe.skipIf(!DIR)('trust_outcome — the guard and the discard are observable', () => {
  const ask = async (provider: ReturnType<typeof modelSaying>, messages: readonly string[]) => {
    const analytics = createRecordingAnalytics()
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider, analytics })
    let cid: string | undefined
    let body: ChatResponse | undefined
    for (const m of messages) {
      const out = await svc.handle({ message: m, conversationId: cid })
      body = out.body as ChatResponse
      cid = body.conversationId
    }
    return { analytics, body: body! }
  }

  it('✓ model cites evidence it was never given → prose DISCARDED, with the reason', async () => {
    // The model invents an evidence id. The opinion validator rejects the whole answer.
    const provider = modelSaying(() => ({
      answer: 'Kumaraguru College of Technology is the strongest fit for you.',
      confidence: 'high',
      citations: [{ evidenceId: 'ev-i-invented-this', collegeName: 'Kumaraguru College of Technology' }],
    }))
    const { analytics } = await ask(provider, ['is kumaraguru good?'])
    const ev = trustEvent(analytics.events)

    expect(ev).toBeDefined()
    expect(ev!.usedModel).toBe(false) // the prose was thrown away…
    // …and now we know WHY, precisely. A citation failure is caught in the LLM layer FIRST
    // (the adapter rejects + retries + gives up), so the opinion validator can only say
    // 'llm_unusable' — the specific code is what makes "discarded for a GROUNDING failure"
    // countable, as opposed to "the provider timed out".
    expect(ev!.discardReasons).toContain('unknown_citation')
    expect(ev!.discardReasons).toContain('llm_unusable')
    expect(ev!.llmStatus).toBe('rejected')
    expect(ev!.repairedSentenceCount).toBe(0)
  })

  it('✓ THE PREVIOUSLY INVISIBLE CASE: guard strips a sentence, answer still ships', async () => {
    // A well-formed answer that cites REAL evidence, but slips in one ungrounded sentence.
    // The guard removes that sentence and ships the rest — so usedModel STAYS TRUE. Before
    // this change, that turn was indistinguishable from a perfectly clean one.
    const provider = modelSaying((evidenceId) => ({
      answer:
        'This is a strong option for your profile. Hogwarts Institute of Wizardry guarantees a 100% placement rate.',
      confidence: 'high',
      citations: evidenceId ? [{ evidenceId }] : [],
    }))
    const { analytics, body } = await ask(provider, ['is kumaraguru good?'])
    const ev = trustEvent(analytics.events)

    expect(ev).toBeDefined()
    expect(ev!.usedModel).toBe(true) // the answer SHIPPED — this is why it was invisible
    expect(ev!.llmStatus).toBe('repaired') // …but we can now see the guard fired
    expect(ev!.repairedSentenceCount).toBeGreaterThanOrEqual(1) // …and how hard
    expect(ev!.discardReasons).toEqual([]) // not a discard — a repair

    // And the fabrication really was removed from what the parent read.
    expect(body.answer).not.toMatch(/Hogwarts/i)
    expect(body.answer).not.toMatch(/100% placement/i)
  })

  it('✓ a clean model reports clean — no false alarms', async () => {
    const provider = modelSaying((evidenceId) => ({
      answer: 'This is a strong option for your profile.',
      confidence: 'high',
      citations: evidenceId ? [{ evidenceId }] : [],
    }))
    const ev = trustEvent((await ask(provider, ['is kumaraguru good?'])).analytics.events)
    expect(ev!.usedModel).toBe(true)
    expect(ev!.llmStatus).toBe('ok')
    expect(ev!.repairedSentenceCount).toBe(0)
    expect(ev!.discardReasons).toEqual([])
  })

  it('✓ PRIVACY: a discarded turn with a FULL profile leaks no student data and no prose', async () => {
    // The validator's message for this failure is:
    //   `citation references a non-candidate college "<name the model made up>"`
    // and the guard's is the stripped SENTENCE itself. Neither may ever reach the event.
    const provider = modelSaying((evidenceId) => ({
      answer:
        'Your son with a 168 cutoff in the BC community from Coimbatore should pick Hogwarts Institute of Wizardry.',
      confidence: 'high',
      citations: [
        ...(evidenceId ? [{ evidenceId }] : []),
        { evidenceId: 'ev-nope', collegeName: 'Hogwarts Institute of Wizardry' },
      ],
    }))
    const { analytics } = await ask(provider, [
      "my son got 168 cutoff, he's BC, we're in Coimbatore",
      'which colleges can he get?',
    ])
    const ev = trustEvent(analytics.events)
    expect(ev).toBeDefined()
    expect(ev!.usedModel).toBe(false)
    expect(ev!.discardReasons.length).toBeGreaterThan(0) // it DID record a reason…

    // …and every reason is a CODE from the closed enum — never a message. Asserted against
    // the exported enum itself, so a new code can't silently widen what we emit.
    for (const code of ev!.discardReasons) expect(DISCARD_CODES).toContain(code)

    // The whole serialized event carries no student data and no model prose.
    const wire = JSON.stringify(ev)
    expect(wire).not.toMatch(/168/) // no cutoff
    expect(wire).not.toMatch(/\bBC\b/) // no community
    expect(wire).not.toMatch(/coimbatore/i) // no district
    expect(wire).not.toMatch(/my son|he's|we're/i) // no raw message
    expect(wire).not.toMatch(/Hogwarts/i) // no model-supplied name
    expect(wire).not.toMatch(/should pick|cutoff in the/i) // no sentence text
  })
})
