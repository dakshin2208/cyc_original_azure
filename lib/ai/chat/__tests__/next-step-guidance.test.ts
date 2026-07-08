/**
 * @module lib/ai/chat/__tests__/next-step-guidance.test
 *
 * AI Admission Counsellor Experience — Next-Step Guidance (#7) + Parent framing (#6).
 * Proves that a substantive counselling answer ends by guiding the admission journey
 * forward (never a flat "what else would you like to know?"), that the guidance is
 * parent-framed when a parent is talking (facts unchanged, tone changes), and that
 * profile-collection / clarification replies carry no next step. Uses the fixture
 * warehouse with the deterministic (no-model) path.
 */

import { describe, expect, it } from 'vitest'
import { createOpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  emptyProfile,
  nextStep,
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
    idGenerator: () => `nx-${(n += 1)}`,
    timeoutMs: 2000,
  })
}
const ok = (b: unknown): ChatResponse => b as ChatResponse

describe('AI Admission Counsellor — next-step guidance (#7)', () => {
  it('ends a recommendation by guiding the journey forward (not a flat prompt)', async () => {
    const service = await counselorWithProfile(complete, 'c1')
    const body = ok((await service.handle({ message: 'give me college options', conversationId: 'c1' })).body)
    expect(body.answer).toMatch(/would you like|shall we|preference list|compare/i)
    expect(body.answer.toLowerCase()).not.toContain('what else would you like to know')
  })

  it('frames the next step for a parent — facts unchanged, tone changes (#6)', async () => {
    const service = await counselorWithProfile(complete, 'c2')
    const body = ok((await service.handle({ message: 'which colleges are best for my son?', conversationId: 'c2' })).body)
    expect(body.answer).toMatch(/your child/i) // parent-framed guidance
  })

  it('does NOT append a next step to a profile-collection prompt', async () => {
    // A recommendation ask on an empty profile → the counsellor collects the profile
    // (no journey next-step yet). ("hi" now shows the welcome, not a collection prompt.)
    const service = await counselorWithProfile(emptyProfile(), 'c3')
    const body = ok((await service.handle({ message: 'which college is best for me?', conversationId: 'c3' })).body)
    expect(body.stage).toBe('collecting')
    expect(body.answer).not.toMatch(/would you like me to compare|shall we build your preference list/i)
  })
})

describe('nextStep — student vs parent framing', () => {
  it('returns student copy by default and parent copy for parents', () => {
    expect(nextStep('recommend', false)).toMatch(/preference list/i)
    expect(nextStep('recommend', true)).toMatch(/your child/i)
  })
  it('has no next step for profile collection / clarification', () => {
    expect(nextStep('collectSlot', false)).toBeUndefined()
    expect(nextStep('compareNeedsTwo', false)).toBeUndefined()
    expect(nextStep('social', false)).toBeUndefined()
  })
})
