/**
 * @module lib/ai/chat/__tests__/beta-readiness.test
 *
 * Production-readiness characterization tests over the SHIPPED `data/` folder (what the
 * Docker image ships — not a developer's CYC_DATA_DIR). Locks three beta fixes and the
 * RCA safeguard so they cannot silently regress:
 *   1. Eligibility banding is real and cutoff-relative (RCA): a 190 and a 130 student get
 *      DIFFERENT, banded lists — never "eligibility unconfirmed" — proving the CutoffLookup
 *      stays injected end to end.
 *   2. Honest limitation: "does X have hostels?" (plural) declines honestly, not a recommendation.
 *   3. The ROI refinement never collapses to "couldn't verify that college".
 * Runs in CI (no CYC_DATA_DIR); skips if `data/` is absent.
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
  type ProfileStore,
  type StudentProfile,
} from '@/lib/ai/chat'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('beta readiness — shipped data/, production wiring', () => {
  const wh = buildWarehouseFromDirectory(DATA_DIR)
  const repos = createRepositories(wh)
  const retrieval = createRetrievalEngine(repos)
  const cutoffs = createCommunityCutoffLookup(repos) // production injects this (RCA)
  const knownDistricts = new Set<string>()
  for (const c of repos.colleges.list()) {
    const d = repos.colleges.districtOf(c.id)
    if (d) knownDistricts.add(d.toLowerCase())
  }

  let seq = 0
  const complete = (over: Partial<StudentProfile> = {}): StudentProfile =>
    ({ ...emptyProfile(), cutoff: 190, community: 'OC', district: 'coimbatore', branch: 'CSE', answered: { cutoff: true, community: true, district: true, branch: true }, ...over } as StudentProfile)

  async function counselor(profile: StudentProfile, convId: string) {
    const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), cutoffs, systemPrompt: composeCounselorSystem() })
    const profileStore: ProfileStore = createInMemoryProfileStore()
    await profileStore.set(convId, profile)
    const service = createCounselorChatService({
      opinion,
      sessionStore: createInMemorySessionStore(),
      profileStore,
      logger: createNullLogger(),
      clock: () => 0,
      idGenerator: () => `beta-${(seq += 1)}`,
      timeoutMs: 8000,
      resolveDistrict: (input) => resolveDistrict(input, knownDistricts),
    })
    return service
  }
  const say = async (svc: Awaited<ReturnType<typeof counselor>>, message: string, conversationId: string) =>
    ((await svc.handle({ message, conversationId })).body as ChatResponse).answer

  it('eligibility is confirmed and cutoff-relative (RCA safeguard)', async () => {
    const hi = await counselor(complete({ cutoff: 190 } as Partial<StudentProfile>), 'b190')
    const lo = await counselor(complete({ cutoff: 130 } as Partial<StudentProfile>), 'b130')
    const a190 = await say(hi, 'which colleges can I safely get into', 'b190')
    const a130 = await say(lo, 'which colleges can I safely get into', 'b130')
    expect(a190).not.toMatch(/unconfirmed|no historical cutoff/i)
    expect(a130).not.toMatch(/unconfirmed|no historical cutoff/i)
    expect(a190).not.toBe(a130) // different cutoffs → different, banded guidance
  })

  it('honestly declines a plural "hostels" question (not a recommendation)', async () => {
    const svc = await counselor(complete(), 'bhostel')
    const ans = await say(svc, 'does PSG College of Technology have hostels?', 'bhostel')
    expect(ans).toMatch(/hostel or campus-life details|don.t have.*hostel/i)
    expect(ans).not.toMatch(/my top recommendation/i)
  })

  it('the ROI refinement never collapses to "couldn\'t verify that college"', async () => {
    const svc = await counselor(complete(), 'broi')
    const ans = await say(svc, 'what about ROI?', 'broi')
    expect(ans).not.toMatch(/could ?n.t verify that college/i)
    expect(ans).toMatch(/return on investment|roi/i)
  })
})
