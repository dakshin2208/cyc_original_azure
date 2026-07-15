/**
 * @module lib/ai/chat/__tests__/planner-workflow.test
 *
 * The LLM-driven understanding workflow, proved end to end on the REAL failing transcript.
 *
 * The planner is exercised with a STUB provider (canned plans) so the suite stays deterministic
 * and needs no API key — but it flows through the WHOLE pipeline: plan → resolve → the existing
 * engine → the existing validation + hallucination guard → answer. The engine and guards are
 * untouched; the planner only decides WHAT to fetch.
 *
 * The safety regressions are asserted here too: a planner that invents a college is rejected by
 * the existing resolver (the phantom guard), and with NO planner the same turns still answer via
 * the deterministic classifier.
 */

import { describe, expect, it } from 'vitest'
import { createFunctionProvider, createUnavailableProvider, type LLMProvider } from '@/lib/ai/llm'
import { buildCounselorChatService, createNullLogger, createRecordingAnalytics, type ChatResponse } from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

/** A stub "planner LLM": returns a canned plan keyed off the message (simulates understanding). */
const cannedPlanner = (): LLMProvider =>
  createFunctionProvider('stub-planner', (req) => {
    const msg = req.messages.map((m) => m.content).join('\n').toLowerCase()
    let plan: Record<string, unknown> = { action: 'need_more_info', colleges: [], city: null, branch: null, metric: null, limit: null, confidence: 'low', reasoning: '' }
    if (/message: .*placements at cit/.test(msg)) plan = { action: 'metric_query', colleges: ['CIT'], city: 'coimbatore', metric: 'placements', limit: null, confidence: 'high', reasoning: 'metric at CIT' }
    else if (/message: .*deadline/.test(msg)) plan = { action: 'out_of_scope', colleges: [], city: null, confidence: 'high', reasoning: 'process' }
    else if (/message: .*top 10 colleges in coimbatore/.test(msg)) plan = { action: 'list_colleges', colleges: [], city: 'coimbatore', limit: 10, confidence: 'high', reasoning: 'directory' }
    else if (/message: .*ranchi engineering academy/.test(msg)) plan = { action: 'college_overview', colleges: ['Ranchi Engineering Academy'], confidence: 'high', reasoning: 'invented' }
    return { text: JSON.stringify(plan), model: 'stub', finishReason: 'stop' }
  })

describe.skipIf(!DIR)('LLM-driven understanding — the real transcript', () => {
  const make = (provider: LLMProvider) => {
    const analytics = createRecordingAnalytics()
    return { svc: buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider, analytics }), analytics }
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('✓ all six transcript turns, one conversation, planner ON', async () => {
    const { svc, analytics } = make(cannedPlanner())
    const say = async (message: string, cid?: string) => b(await svc.handle({ message, conversationId: cid }))

    // 1. Directory as the FIRST message — a real list, NO profile demanded.
    const t1 = await say('top 10 colleges in coimbatore')
    const cid = t1.conversationId
    expect(t1.stage).toBe('ready')
    expect(t1.answer).toMatch(/^Here are \d+ colleges in Coimbatore/i)
    expect((t1.answer ?? '').match(/^\s*\d+\.\s/gm)?.length ?? 0).toBeGreaterThanOrEqual(5) // a numbered list
    expect(t1.answer).not.toMatch(/what is your cutoff/i) // no profile gate

    // 2. Profile completes.
    await say('158', cid)
    await say('bc', cid)
    const t2 = await say('cse', cid)
    expect(t2.profile?.cutoff).toBe(158)
    expect(t2.profile?.community).toMatch(/bc/i)

    // 3. Eligibility at a named college — answered with the STORED cutoff, NEVER re-asking for it.
    const t3 = await say('for my cutoff which course i get in psg collage', cid)
    expect(t3.answer).toMatch(/PSG College of Technology/i)
    expect(t3.answer).not.toMatch(/share your cutoff|what is your cutoff|which community/i) // the self-contradiction, gone
    expect(t3.answer).toMatch(/I have your cutoff and community/i) // it acknowledges it HAS them

    // 4. Same for Kumaraguru.
    const t4 = await say('for my cutoff which course i get in kumaraguru collage', cid)
    expect(t4.answer).toMatch(/Kumaraguru College of Technology/i)
    expect(t4.answer).not.toMatch(/share your cutoff|which community/i)

    // 5. Abbreviation the fuzzy matcher can't crack — the planner resolves CIT.
    const t5 = await say('what are the placements at CIT?', cid)
    expect(t5.answer).toMatch(/Coimbatore Institute of Technology/i)
    expect(t5.answer).not.toMatch(/Sri Krishna|K\.S\.RANGASAMY|Rathinam/i) // NOT a global list

    // 6. Out-of-scope TNEA process — honest decline, no invented date.
    const t6 = await say('when is the TNEA deadline?', cid)
    expect(t6.answer).toMatch(/don'?t have that one|not in the official college dataset/i)
    expect(t6.answer).not.toMatch(/https?:\/\/|\b20\d\d\b/) // no fabricated URL or date

    // Telemetry: the planner's decisions were logged, enums only.
    const plannerEvents = analytics.events.filter((e) => e.type === 'planner_decision')
    expect(plannerEvents.length).toBeGreaterThan(0)
    expect(JSON.stringify(plannerEvents)).not.toMatch(/158|coimbatore.*158|placements at cit/i) // no raw message
  })

  it('✓ SAFETY: a planner that invents a college is rejected by the resolver (phantom guard holds)', async () => {
    const { svc } = make(cannedPlanner())
    // The stub plans college_overview for "ranchi engineering academy" — a college NOT in the
    // warehouse. The resolver finds nothing, so the rewrite is rejected and the turn falls back.
    const out = b(await svc.handle({ message: 'is ranchi engineering academy good' }))
    expect(out.answer).not.toMatch(/Ranchi Engineering Academy/i) // never conjured into an answer
  })

  it('✓ DEGRADE: with the LLM unreachable, the same turns still answer via the classifier', async () => {
    const { svc } = make(createUnavailableProvider('none'))
    // Directory listing is deterministic — it works with no planner at all.
    const list = b(await svc.handle({ message: 'top 10 colleges in coimbatore' }))
    expect(list.answer).toMatch(/^Here are \d+ colleges in Coimbatore/i)

    // Eligibility with a stored profile also works deterministically (Bug-1 note fix).
    const svc2 = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: createUnavailableProvider('none') })
    const first = b(await svc2.handle({ message: '158 BC Coimbatore CSE' }))
    const elig = b(await svc2.handle({ message: 'can i get into psg', conversationId: first.conversationId }))
    expect(elig.answer).not.toMatch(/share your cutoff|which community/i)
  })

  it('✓ REGRESSION: the TNEA-deadline decline still holds with NO planner', async () => {
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: createUnavailableProvider('none') })
    const first = b(await svc.handle({ message: '190 OC Chennai CSE' }))
    const out = b(await svc.handle({ message: 'when is the TNEA deadline?', conversationId: first.conversationId }))
    expect(out.answer).toMatch(/don'?t have that one/i)
    expect(out.answer).not.toMatch(/my top recommendation/i)
  })
})

// The planner now owns UNDERSTANDING for every question turn. A wrong planner must not be able to
// invent data we don't have, resolve a phantom, or override an honest decline.
describe.skipIf(!DIR)('planner on EVERY turn — guards still win', () => {
  const b = (o: { body: unknown }) => o.body as ChatResponse

  /** A misbehaving planner that ALWAYS proposes list_colleges — the worst case for the guards. */
  const alwaysLists = (): LLMProvider =>
    createFunctionProvider('stub-bad', () => ({
      text: JSON.stringify({ action: 'list_colleges', colleges: [], city: 'coimbatore', limit: 10, confidence: 'high', reasoning: 'x' }),
      model: 'stub',
      finishReason: 'stop',
    }))

  it('✓ GUARD: "what are the cheapest colleges?" declines on fees even though the planner says list', async () => {
    const analytics = createRecordingAnalytics()
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: alwaysLists(), analytics })
    const out = b(await svc.handle({ message: 'what are the cheapest colleges?' }))
    expect(out.answer).toMatch(/don'?t have|won'?t guess|not available|no .* fee/i) // honest fee decline
    expect(out.answer).not.toMatch(/^Here are \d+ colleges/i) // the planner's list did NOT win
    const pd = analytics.events.find((e) => e.type === 'planner_decision') as { guardOverride?: boolean } | undefined
    expect(pd?.guardOverride).toBe(true) // logged that a guard beat the planner
  })

  it('✓ GUARD: hostel query still declines regardless of the planner', async () => {
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: alwaysLists() })
    const out = b(await svc.handle({ message: 'which colleges have the best hostels?' }))
    expect(out.answer).not.toMatch(/^Here are \d+ colleges/i)
    expect(out.answer).toMatch(/hostel/i)
  })

  it('✓ PHANTOM: a planner that plans an invented college is rejected; "my son" never becomes a college', async () => {
    const invents = createFunctionProvider('stub-phantom', (req) => {
      const msg = req.messages.map((m) => m.content).join('\n').toLowerCase()
      const plan = /my son/.test(msg)
        ? { action: 'college_overview', colleges: ['Sona College of Technology'], confidence: 'high', reasoning: 'x' }
        : { action: 'need_more_info', colleges: [], confidence: 'low', reasoning: 'x' }
      return { text: JSON.stringify(plan), model: 'stub', finishReason: 'stop' }
    })
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: invents })
    // Even though the planner (wrongly) emits a real college name for a "my son" message, the
    // message names none — and the profile must capture no phantom.
    const out = b(await svc.handle({ message: 'my son got 158, BC' }))
    expect(out.profile?.preferredCollege ?? null).toBeNull()
  })

  it('✓ EVERY TURN: the planner fires even on a turn the classifier already handled', async () => {
    const analytics = createRecordingAnalytics()
    // A planner that agrees (college_overview) — proves it RAN on an easy turn, not that it changed it.
    const agrees = createFunctionProvider('stub-agrees', () => ({
      text: JSON.stringify({ action: 'college_overview', colleges: ['Kumaraguru'], confidence: 'high', reasoning: 'x' }),
      model: 'stub',
      finishReason: 'stop',
    }))
    const svc = buildCounselorChatService({ dataDir: DIR, logger: createNullLogger(), provider: agrees, analytics })
    const out = b(await svc.handle({ message: 'is Kumaraguru good?' }))
    expect(out.answer).toMatch(/Kumaraguru College of Technology/i) // still answered correctly
    expect(analytics.events.some((e) => e.type === 'planner_decision')).toBe(true) // planner ran on this easy turn
  })
})
