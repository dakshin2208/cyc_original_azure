/**
 * @module lib/ai/chat/__tests__/branch-optional.test
 *
 * Branch is an OPTIONAL profile slot.
 *
 * A multi-turn diagnostic showed the counsellor deadlocking: a parent gave cutoff +
 * community + district, and the bot answered "which engineering branch?" on four separate
 * turns without ever recommending a college. Root cause: `branch` was a REQUIRED slot, so
 * `isComplete()` stayed false forever and every recommendation-class turn was re-routed to
 * `collectSlot`.
 *
 * Business rule locked in here: cutoff + community are what genuinely gate eligibility.
 * Branch is a refinement — the counsellor may offer the question at most once while the
 * profile is being filled, and must NEVER block an answer on it. With `branch === null`
 * the recommendation engine ranks across all branches ("any branch"), so a parent who gives
 * rank + community + city gets colleges.
 *
 * Runs on the PRODUCTION wiring with NO API key, so every assertion below is proved on the
 * deterministic path.
 */

import { describe, expect, it } from 'vitest'
import { createUnavailableProvider } from '@/lib/ai/llm'
import { buildCounselorChatService, createNullLogger, type ChatResponse } from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

// The counsellor's slot prompts. `REASK` is the deadlock signature; `SELF_CONTRADICT` is the
// T9 bug (asking for a cutoff it was already given).
const BRANCH_ASK = /engineering branch/i
const CUTOFF_ASK = /what is your cutoff|share your cutoff/i
const COMMUNITY_ASK = /which community do you belong to/i
const DISTRICT_ASK = /district or location/i
const BAND = /\b(safe|balanced|moderate|target|ambitious|dream|reach|stretch)\b/i
const GUARANTEE = /\b(you|he|she)\s+will\s+(definitely\s+)?get\b|guaranteed admission|100%\s*(admission|sure)/i

describe.skipIf(!DIR)('branch is optional — a profile with cutoff + community can be counselled', () => {
  const make = () => {
    let n = 0
    return buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'), // deterministic: no LLM, no API key
      idGenerator: () => `bo-${(n += 1)}`,
    })
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('✓ ONE session: cutoff+community+district → recommendation-class turns are ANSWERED, branch asked at most once', async () => {
    const svc = make()
    const answers: string[] = []
    const say = async (message: string, conversationId?: string) => {
      const out = await svc.handle({ message, conversationId })
      answers.push(b(out).answer ?? '')
      return b(out)
    }

    // T1 — the parent hands over the whole profile except branch.
    const t1 = await say("my son got 168 cutoff, he's BC, we're in Coimbatore")
    const cid = t1.conversationId
    expect(t1.profile?.cutoff).toBe(168)
    expect(t1.profile?.community).toMatch(/bc/i)
    expect(t1.profile?.district).toMatch(/coimbatore/i)
    expect(t1.profile?.complete).toBe(true) // cutoff + community IS complete enough to counsel

    // T2 — the next recommendation-class turn must return a REAL multi-college list.
    const t2 = await say('what about colleges with better placements?', cid)
    expect(t2.answer).not.toMatch(BRANCH_ASK) // ← the deadlock, gone
    expect(t2.stage).toBe('ready')
    expect((t2.answer ?? '').match(/^\s*•/gm)?.length ?? 0).toBeGreaterThanOrEqual(2) // a real list
    expect(t2.answer).toMatch(/top recommendation/i)

    // T3 — a location constraint must not restart onboarding either.
    const t3 = await say("he doesn't want to leave Coimbatore", cid)
    expect(t3.answer).not.toMatch(BRANCH_ASK)
    expect(t3.profile?.cutoff).toBe(168) // profile survives

    // T4 — the closing "what would you recommend?" is a recommendation, not a question.
    const t4 = await say('so honestly, what would you recommend for my son?', cid)
    expect(t4.answer).not.toMatch(BRANCH_ASK)
    expect(t4.answer).toMatch(/top recommendation|based on your profile/i)

    // Branch is offered AT MOST ONCE across the whole session, and no slot already
    // given is ever re-asked.
    const branchAsks = answers.filter((a) => BRANCH_ASK.test(a)).length
    expect(branchAsks).toBeLessThanOrEqual(1)
    for (const a of answers) {
      expect(a).not.toMatch(CUTOFF_ASK)
      expect(a).not.toMatch(COMMUNITY_ASK)
      expect(a).not.toMatch(DISTRICT_ASK)
    }
  })

  it('✓ No self-contradiction: "are you sure he\'ll get in?" never asks for a cutoff it already has', async () => {
    const svc = make()
    const first = await svc.handle({ message: "my son got 168 cutoff, he's BC, we're in Coimbatore" })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: "are you sure he'll get in?", conversationId: cid })
    const answer = b(out).answer ?? ''

    expect(answer).not.toMatch(CUTOFF_ASK) // ← the T9 self-contradiction, gone
    expect(answer).not.toMatch(COMMUNITY_ASK)
    expect(answer).toMatch(BAND) // it answers with an eligibility band instead
    expect(answer).not.toMatch(GUARANTEE) // and never promises a seat
  })

  it('✓ Regression: cutoff + community still drive community-aware eligibility banding', async () => {
    const svc = make()
    // A low cutoff must NOT be told the same story as a high one — banding still works with
    // no branch in the profile at all.
    const counsel = async (profileMsg: string) => {
      const first = b(await svc.handle({ message: profileMsg }))
      expect(first.profile?.complete).toBe(true) // complete WITHOUT a branch
      const out = b(await svc.handle({ message: 'which colleges can I safely get into?', conversationId: first.conversationId }))
      expect(out.answer).not.toMatch(BRANCH_ASK) // never blocked on branch
      return out.answer ?? ''
    }
    const low = await counsel('120 BC Coimbatore')
    const high = await counsel('198 BC Coimbatore')
    expect(low).toMatch(BAND)
    expect(high).toMatch(BAND)
    expect(low).not.toBe(high) // the rank genuinely changes the counsel
  })

  it('✓ Regression: an empty profile still onboards — cutoff and community remain REQUIRED', async () => {
    const svc = make()
    // No cutoff → blocked on cutoff (the slot that genuinely gates eligibility).
    let out = await svc.handle({ message: 'suggest colleges for me' })
    const cid = b(out).conversationId
    expect(b(out).answer).toMatch(/cutoff/i)
    expect(b(out).profile?.complete).toBe(false)

    // Cutoff given, community still missing → blocked on community, NOT waved through.
    out = await svc.handle({ message: '190', conversationId: cid })
    expect(b(out).answer).toMatch(COMMUNITY_ASK)
    expect(b(out).profile?.complete).toBe(false)

    // Community given → complete, and counselling starts WITHOUT a branch.
    out = await svc.handle({ message: 'BC', conversationId: cid })
    expect(b(out).profile?.complete).toBe(true)
  })
})

describe.skipIf(!DIR)('no phantom college is written into the profile', () => {
  const make = () => buildCounselorChatService({
    dataDir: DIR,
    logger: createNullLogger(),
    provider: createUnavailableProvider('none'),
  })
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('✓ "my son got 168 cutoff…" leaves preferredCollege NULL (no Sona phantom)', async () => {
    const out = b(await make().handle({ message: "my son got 168 cutoff, he's BC, we're in Coimbatore" }))
    expect(out.profile?.preferredCollege).toBeNull()
  })

  it('✓ "is it realistic for him?" adds no phantom, and is not answered ABOUT a college nobody named', async () => {
    const svc = make()
    const first = b(await svc.handle({ message: "my son got 168 cutoff, he's BC, we're in Coimbatore" }))
    const out = b(await svc.handle({ message: 'is it realistic for him?', conversationId: first.conversationId }))
    expect(out.profile?.preferredCollege).toBeNull() // no M.P.Nachimuthu phantom
    expect(out.answer).not.toMatch(/Nachimuthu|Ponjesly/i) // never names a college nobody mentioned
  })

  it('✓ a REAL college mention is still stored as the preferred college', async () => {
    const out = b(await make().handle({ message: 'is kumaraguru good?' }))
    expect(out.profile?.preferredCollege).toMatch(/Kumaraguru/i)
  })
})
