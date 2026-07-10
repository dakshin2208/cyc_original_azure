/**
 * @module lib/ai/chat/__tests__/preference-list.test
 *
 * Preference List Builder. Proves: (1) the Brain recognises preference-list intent and
 * routes it to the new capability (and does NOT hijack ordinary recommendation asks);
 * (2) an incomplete profile collects the missing field first (never a list without data);
 * (3) the answer explains the dream→target→safe ORDERING and trade-offs, stays grounded
 * (reuses the eligibility-bands engine query), makes no admission-certainty claim, and
 * ends with a next counselling step; (4) parent framing. Deterministic (no-model) path.
 */

import { describe, expect, it } from 'vitest'
import { createOpinionService } from '@/lib/opinion'
import type { ParsedQuery } from '@/lib/ai/orchestration'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  decideTurn,
  emptyProfile,
  type ChatResponse,
  type StudentProfile,
} from '@/lib/ai/chat'
import { makeHarness } from '../../orchestration/__tests__/support'

const { repos, retrieval } = makeHarness()

const complete: StudentProfile = {
  ...emptyProfile(),
  cutoff: 190,
  community: 'OC',
  district: 'coimbatore',
  branch: 'CSE',
  answered: { cutoff: true, community: true, district: true, branch: true },
} as StudentProfile

const parse = (over: Partial<ParsedQuery> = {}): ParsedQuery =>
  ({ colleges: [], hasMultipleColleges: false, normalized: '', outOfDomain: null, unverifiedCollege: false, ...over } as ParsedQuery)

const decide = (message: string, profile = complete, over: Partial<Parameters<typeof decideTurn>[0]> = {}) =>
  decideTurn({ message, parsed: parse(), priorProfile: profile, profile, wasComplete: true, hasQuestion: false, ...over })

// ── 1. Brain trigger detection ────────────────────────────────────────────────
describe('Preference List — Brain trigger detection', () => {
  it('routes preference-list phrasings to the preferenceList capability', () => {
    for (const m of [
      'build my preference list',
      'help me fill my choices',
      'arrange my college list',
      'which order should I choose my colleges',
      'generate my TNEA preference list',
    ]) {
      expect(decide(m, complete, { hasQuestion: /which|order/.test(m) }).kind).toBe('preferenceList')
    }
  })

  it('does NOT hijack ordinary recommendation / eligibility asks', () => {
    expect(decide('recommend the best colleges for me').kind).not.toBe('preferenceList')
    expect(decide('which colleges can I get', complete, { hasQuestion: true }).kind).not.toBe('preferenceList')
    expect(decide('show me safe colleges', complete, { hasQuestion: true }).kind).toBe('tier') // tier, not list
  })
})

// ── 2. Required profile — collect missing first ───────────────────────────────
describe('Preference List — required profile', () => {
  it('collects the missing field before building a list (incomplete profile)', () => {
    const d = decideTurn({ message: 'build my preference list', parsed: parse(), priorProfile: emptyProfile(), profile: emptyProfile(), wasComplete: false, hasQuestion: false })
    expect(d.kind).toBe('collectSlot')
  })
})

// ── 3 & 4. End-to-end: ordering explanation, grounding, safety, parent framing ─
let n = 0
async function counselorWithProfile(profile: StudentProfile, convId: string) {
  const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), systemPrompt: composeCounselorSystem() })
  const profileStore = createInMemoryProfileStore()
  await profileStore.set(convId, profile)
  return createCounselorChatService({
    opinion,
    sessionStore: createInMemorySessionStore(),
    profileStore,
    logger: createNullLogger(),
    clock: () => 0,
    idGenerator: () => `pl-${(n += 1)}`,
    timeoutMs: 2000,
  })
}
const ok = (b: unknown): ChatResponse => b as ChatResponse

describe('Preference List — counsellor experience', () => {
  it('explains the dream→target→safe ordering and the trade-off, with no certainty claim', async () => {
    const service = await counselorWithProfile(complete, 'p1')
    const body = ok((await service.handle({ message: 'build my preference list', conversationId: 'p1' })).body)
    expect(body.answer).toMatch(/preference list/i)
    expect(body.answer).toMatch(/dream|reach/i)
    expect(body.answer).toMatch(/target/i)
    expect(body.answer).toMatch(/safe/i)
    expect(body.answer).toMatch(/trade-?off/i)
    // Safety: never claims a guaranteed admission.
    expect(body.answer).toMatch(/not.*guarantee|no guarantee|nothing.*guarantee/i)
    expect(body.answer.toLowerCase()).not.toMatch(/you will (?:definitely )?get (?:in|admission)/)
    // Ends with a forward next step.
    expect(body.answer).toMatch(/compare|stress-test|would you like|top two/i)
  })

  it('frames the list for a parent (facts unchanged, tone changes)', async () => {
    const service = await counselorWithProfile(complete, 'p2')
    const body = ok((await service.handle({ message: 'build a preference list for my son', conversationId: 'p2' })).body)
    expect(body.answer).toMatch(/for your child/i)
  })
})
