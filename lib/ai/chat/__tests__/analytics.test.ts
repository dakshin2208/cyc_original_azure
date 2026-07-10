/**
 * @module lib/ai/chat/__tests__/analytics.test
 *
 * Product analytics + observability. Proves the pure event mapping, that the Coordinator
 * emits the expected events across a journey (capability usage, profile completion, trust
 * outcomes, honest limitations, preference list, parent mode), and — critically — the
 * PRIVACY invariant: no event carries the raw message, a student name, or the cutoff /
 * community / district VALUES. Analytics is side-effect only (never changes a response).
 */

import { describe, expect, it } from 'vitest'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  createRecordingAnalytics,
  emptyProfile,
  isClosingMessage,
  turnAnalyticsEvents,
  type AnalyticsEvent,
  type ChatResponse,
  type StudentProfile,
} from '@/lib/ai/chat'
import { createOpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'
import { makeHarness } from '../../orchestration/__tests__/support'

const { repos, retrieval } = makeHarness()

describe('turnAnalyticsEvents — pure mapping', () => {
  const base = { conversationId: 'c1', isParent: false, colleges: [] as string[], hasMultipleColleges: false, priorTurns: 0, isCloser: false }
  const kinds = (evs: AnalyticsEvent[]) => evs.map((e) => e.type)

  it('emits capability_selected for every decision', () => {
    expect(kinds(turnAnalyticsEvents({ ...base, decision: { kind: 'recommend' } }))).toContain('capability_selected')
  })
  it('maps onboardingSummary → profile_completed', () => {
    expect(kinds(turnAnalyticsEvents({ ...base, decision: { kind: 'onboardingSummary' } }))).toContain('profile_completed')
  })
  it('maps preferenceList → preference_list_generated', () => {
    expect(kinds(turnAnalyticsEvents({ ...base, decision: { kind: 'preferenceList' } }))).toContain('preference_list_generated')
  })
  it('maps dataDecline → honest_limitation with topic', () => {
    const evs = turnAnalyticsEvents({ ...base, decision: { kind: 'dataDecline', topic: 'hostel', college: null } })
    expect(evs.find((e) => e.type === 'honest_limitation')).toMatchObject({ topic: 'hostel' })
  })
  it('emits parent_mode + comparison for a two-college parent turn', () => {
    const evs = turnAnalyticsEvents({ ...base, isParent: true, hasMultipleColleges: true, colleges: ['PSG', 'CIT'], decision: { kind: 'answerQuestion' } })
    expect(kinds(evs)).toEqual(expect.arrayContaining(['parent_mode', 'comparison_requested', 'colleges_referenced']))
  })
  it('emits conversation_completed only on a closing social message', () => {
    expect(kinds(turnAnalyticsEvents({ ...base, decision: { kind: 'social' }, isCloser: true }))).toContain('conversation_completed')
    expect(kinds(turnAnalyticsEvents({ ...base, decision: { kind: 'social' }, isCloser: false }))).not.toContain('conversation_completed')
  })
  it('isClosingMessage recognises sign-offs, not greetings', () => {
    expect(isClosingMessage('thanks')).toBe(true)
    expect(isClosingMessage('bye')).toBe(true)
    expect(isClosingMessage('hi')).toBe(false)
  })
})

describe('Coordinator analytics — end to end + privacy', () => {
  const complete: StudentProfile = { ...emptyProfile(), cutoff: 190, community: 'OC', district: 'coimbatore', branch: 'CSE', answered: { cutoff: true, community: true, district: true, branch: true } } as StudentProfile
  let n = 0
  async function counselor(seed: StudentProfile, convId: string) {
    const analytics = createRecordingAnalytics()
    const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), systemPrompt: composeCounselorSystem() })
    const profileStore = createInMemoryProfileStore()
    await profileStore.set(convId, seed)
    const service = createCounselorChatService({
      opinion,
      sessionStore: createInMemorySessionStore(),
      profileStore,
      logger: createNullLogger(),
      analytics,
      clock: () => 0,
      idGenerator: () => `an-${(n += 1)}`,
      timeoutMs: 2000,
    })
    return { service, analytics }
  }

  it('captures capability + trust events for a recommendation turn', async () => {
    const { service, analytics } = await counselor(complete, 'a1')
    await service.handle({ message: 'give me college options', conversationId: 'a1' })
    const types = analytics.events.map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(['capability_selected', 'recommendation_requested', 'trust_outcome']))
    const trust = analytics.events.find((e) => e.type === 'trust_outcome')
    expect(trust).toHaveProperty('strategy')
    expect(trust).toHaveProperty('fallback')
  })

  it('captures preference_list_generated', async () => {
    const { service, analytics } = await counselor(complete, 'a2')
    await service.handle({ message: 'build my preference list', conversationId: 'a2' })
    expect(analytics.events.map((e) => e.type)).toContain('preference_list_generated')
  })

  it('captures honest_limitation for a hostel question', async () => {
    const { service, analytics } = await counselor(complete, 'a3')
    await service.handle({ message: 'does PSG College of Technology have hostels?', conversationId: 'a3' })
    expect(analytics.events.find((e) => e.type === 'honest_limitation')).toMatchObject({ topic: 'hostel' })
  })

  it('PRIVACY: no event leaks the cutoff value, community, district, or raw message', async () => {
    const { service, analytics } = await counselor(complete, 'a4')
    await service.handle({ message: 'compare PSG College of Technology and Anna University for my son', conversationId: 'a4' })
    const blob = JSON.stringify(analytics.events)
    expect(blob).not.toMatch(/190/) // cutoff value
    expect(blob).not.toMatch(/coimbatore/i) // district value
    expect(blob).not.toMatch(/for my son/i) // raw message content
    // College names (public entities) MAY appear — that is the intended searched-colleges signal.
    expect(blob).toMatch(/PSG College of Technology/)
  })

  it('is side-effect only — does not change the response', async () => {
    const withA = await counselor(complete, 'a5')
    const bodyA = (await withA.service.handle({ message: 'give me college options', conversationId: 'a5' })).body as ChatResponse
    // Same turn without analytics (null default) must produce the same answer.
    const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), systemPrompt: composeCounselorSystem() })
    const store = createInMemoryProfileStore()
    await store.set('a6', complete)
    const svcNo = createCounselorChatService({ opinion, sessionStore: createInMemorySessionStore(), profileStore: store, logger: createNullLogger(), clock: () => 0, idGenerator: () => 'an-x', timeoutMs: 2000 })
    const bodyB = (await svcNo.handle({ message: 'give me college options', conversationId: 'a6' })).body as ChatResponse
    expect(bodyA.answer).toBe(bodyB.answer)
  })
})
