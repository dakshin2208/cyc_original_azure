/**
 * @module lib/ai/chat/__tests__/intent-first.test
 *
 * Intent-first counselling: the AI Chat no longer front-loads profile questions. It shows
 * a welcome, answers knowledge/comparison/branch immediately with NO profile, and collects
 * profile fields ONLY for recommendation / preference-list / eligibility — and only the
 * missing ones. Runs over the shipped `data/` (skips if absent), production-wired.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup } from '@/lib/recommendation'
import { createOpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  emptyProfile,
  resolveDistrict,
  type ChatResponse,
  type StudentProfile,
} from '@/lib/ai/chat'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('intent-first counselling (shipped data/)', () => {
  const wh = buildWarehouseFromDirectory(DATA_DIR)
  const repos = createRepositories(wh)
  const retrieval = createRetrievalEngine(repos)
  const cutoffs = createCommunityCutoffLookup(repos)
  const kd = new Set<string>()
  for (const c of repos.colleges.list()) { const d = repos.colleges.districtOf(c.id); if (d) kd.add(d.toLowerCase()) }

  let n = 0
  async function counselor(seed?: StudentProfile) {
    const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), cutoffs, systemPrompt: composeCounselorSystem() })
    const profileStore = createInMemoryProfileStore()
    const conv = `if-${(n += 1)}`
    if (seed) await profileStore.set(conv, seed)
    const service = createCounselorChatService({
      opinion, sessionStore: createInMemorySessionStore(), profileStore, logger: createNullLogger(),
      clock: () => 0, idGenerator: () => `id-${n}`, timeoutMs: 8000, resolveDistrict: (x) => resolveDistrict(x, kd),
    })
    return { service, conv }
  }
  const NO_PROFILE_ASK = /what is your cutoff mark|which community do you belong|which district or location|which engineering branch are you interested|i'd be happy to help.*need a few/i
  const ask = async (svc: Awaited<ReturnType<typeof counselor>>, message: string) =>
    (await svc.service.handle({ message, conversationId: svc.conv })).body as ChatResponse

  it('greeting → welcome, no profile questions', async () => {
    const body = await ask(await counselor(), 'hi')
    expect(body.answer).toMatch(/welcome to chooseyourcollege ai admission counsellor/i)
    expect(body.answer).not.toMatch(NO_PROFILE_ASK)
  })

  it('1) placement question first → immediate answer (no profile)', async () => {
    const body = await ask(await counselor(), 'what are the placements at PSG College of Technology?')
    expect(body.stage).toBe('ready')
    expect(body.answer).not.toMatch(NO_PROFILE_ASK)
    expect(body.answer).toMatch(/PSG/i)
  })

  it('2) comparison → immediate comparison (no profile)', async () => {
    const body = await ask(await counselor(), 'compare PSG College of Technology and Anna University')
    expect(body.stage).toBe('ready')
    expect(body.answer).not.toMatch(NO_PROFILE_ASK)
    expect(body.answer).toMatch(/compare|lean towards|★|placements|reputation/i)
  })

  it('3) branch guidance → immediate answer (no profile)', async () => {
    const body = await ask(await counselor(), 'which engineering branch has the best future?')
    expect(body.stage).toBe('ready')
    expect(body.answer).not.toMatch(NO_PROFILE_ASK)
    expect(body.answer.length).toBeGreaterThan(0)
  })

  it('4) recommendation → collects ONLY the missing fields (starts with cutoff)', async () => {
    const svc = await counselor()
    const body = await ask(svc, 'which college is best for me?')
    expect(body.stage).toBe('collecting')
    expect(body.answer).toMatch(/cutoff/i)
    expect(body.answer).toMatch(/i'd be happy to help|need a few/i) // intent-aware intro
  })

  it('5) preference list → collects the missing profile', async () => {
    const body = await ask(await counselor(), 'build my preference list')
    expect(body.stage).toBe('collecting')
    expect(body.answer).toMatch(/cutoff/i)
  })

  it('6) already has a profile → recommends WITHOUT re-asking', async () => {
    const complete: StudentProfile = { ...emptyProfile(), cutoff: 190, community: 'OC', district: 'coimbatore', branch: 'CSE', answered: { cutoff: true, community: true, district: true, branch: true } } as StudentProfile
    const body = await ask(await counselor(complete), 'which college is best for me?')
    expect(body.stage).toBe('ready')
    expect(body.answer).not.toMatch(NO_PROFILE_ASK)
    expect(body.answer).toMatch(/based on your profile|top recommendation/i)
  })
})
