/**
 * @module lib/ai/chat/__tests__/global-ranking.test
 *
 * "Stop interrogating." A global category/dimension/branch ranking answers from the warehouse
 * WITHOUT a profile — the recommendation engine takes cutoff/community as OPTIONAL filters, so a
 * question that ranks by branch, placements, or govt/private never needs to demand a profile
 * first. Personalisation is offered as ONE closing line, never as a gate.
 *
 * The boundary is asserted too: a PERSONAL-FIT ask ("which can I get", "safe for me") genuinely
 * needs cutoff+community and still, correctly, asks.
 *
 * Deterministic (no API key) — every answer here is the grounded fallback, so the routing and
 * the caveat/offer wording are proven without the LLM.
 */

import { describe, expect, it } from 'vitest'
import { createUnavailableProvider } from '@/lib/ai/llm'
import { buildCounselorChatService, createNullLogger, type ChatResponse } from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

const GATE_ASK = /what is your cutoff|which community do you belong|need a few (quick )?details/i
const BODY_DEMAND = /I need your cutoff|please (?:share|provide|tell me) your cutoff/i
const OFFER = /if you tell me your cutoff and community/i

describe.skipIf(!DIR)('global rankings answer without a profile; personal-fit still asks', () => {
  const fresh = () => buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: createUnavailableProvider('none') })
  const b = (o: { body: unknown }) => o.body as ChatResponse
  /** The answer body WITHOUT the sanctioned closing offer (so we can assert the body never demands). */
  const bodyOnly = (a: string) => a.replace(/\n*If you tell me your cutoff and community[^\n]*/i, '')

  it('GAP 1 — "which are the best colleges for CSE?" → real colleges, zero questions', async () => {
    const out = b(await fresh().handle({ message: 'which are the best colleges for CSE?' }))
    expect(out.stage).toBe('ready')
    expect(out.answer).not.toMatch(GATE_ASK) // no profile demanded
    expect(out.answer).toMatch(/top recommendation|other strong options|ranked/i) // real ranking
    expect(bodyOnly(out.answer ?? '')).not.toMatch(BODY_DEMAND) // no cutoff demand in the body
    expect(out.answer).toMatch(OFFER) // the ask lives only in the closing offer
  })

  it('GAP 2 — "which colleges have the best placements?" → placement-ranked list, zero questions', async () => {
    const out = b(await fresh().handle({ message: 'which colleges have the best placements?' }))
    expect(out.answer).not.toMatch(GATE_ASK)
    expect(out.answer).toMatch(/placement/i)
    expect(out.answer).toMatch(/top recommendation|₹|%/) // real figures
    expect(bodyOnly(out.answer ?? '')).not.toMatch(BODY_DEMAND)
  })

  it('GAP 3 — "is Kumaraguru good?" → real figures, no cutoff demand in the body', async () => {
    const out = b(await fresh().handle({ message: 'is Kumaraguru good?' }))
    expect(out.answer).toMatch(/Kumaraguru College of Technology/i)
    expect(out.answer).toMatch(/Power Score|₹|%/) // real facts
    expect(bodyOnly(out.answer ?? '')).not.toMatch(BODY_DEMAND) // the overview never demands a cutoff
    // A soft eligibility CAVEAT is allowed; a demand is not.
    expect(out.answer).toMatch(/Eligibility here isn.t confirmed|If you tell me your cutoff/i)
  })

  it('REGRESSION — "top 10 colleges in coimbatore" still lists', async () => {
    const out = b(await fresh().handle({ message: 'top 10 colleges in coimbatore' }))
    expect(out.answer).toMatch(/^Here are \d+ colleges in Coimbatore/i)
    expect(out.answer).not.toMatch(GATE_ASK)
  })

  it('REGRESSION — "compare PSG and Kumaraguru" still compares', async () => {
    const out = b(await fresh().handle({ message: 'compare PSG College of Technology and Kumaraguru College of Technology' }))
    expect(out.answer).toMatch(/compare|lean towards|★/i)
    expect(out.answer).not.toMatch(GATE_ASK)
  })

  it('BOUNDARY — "can my son get into PSG?" is genuine eligibility: it states what it knows, may ask', async () => {
    const out = b(await fresh().handle({ message: 'can my son get into PSG?' }))
    expect(out.answer).toMatch(/PSG College of Technology/i) // states what it knows first
    // It's allowed to reference the cutoff need here (eligibility genuinely needs it), but only
    // after naming the college — never a bare gate prompt.
    expect(out.stage).toBe('ready')
  })

  it('BOUNDARY — "which colleges can I get?" (personal-fit, no profile) still asks', async () => {
    const out = b(await fresh().handle({ message: 'which colleges can I get?' }))
    expect(out.stage).toBe('collecting')
    expect(out.answer).toMatch(GATE_ASK) // personal eligibility legitimately needs cutoff+community
  })

  it('REGRESSION — with a profile, "which colleges can he get?" personalises (not a global list)', async () => {
    const svc = fresh()
    const first = b(await svc.handle({ message: '158 BC Coimbatore CSE' }))
    expect(first.profile?.cutoff).toBe(158) // the one-shot profile still merged (not mistaken for a ranking)
    const out = b(await svc.handle({ message: 'which colleges can he get?', conversationId: first.conversationId }))
    expect(out.answer).toMatch(/Based on your profile/i)
    expect(out.answer).not.toMatch(OFFER) // complete profile → no closing offer, already personalised
  })
})
