/**
 * @module lib/ai/chat/__tests__/conversation-flow.test
 *
 * The conversational profile layer: collect cutoff → community → district → branch,
 * persist the profile per conversation, then answer every question using it. The
 * recommendation engine is unchanged — it simply receives the completed profile as
 * query overrides. Pure slot-filling unit tests + gated end-to-end scenarios.
 */

import { describe, expect, it } from 'vitest'
import type { CommunityCode } from '@/lib/knowledge'
import type { ParsedQuery } from '@/lib/ai/orchestration'
import { createUnavailableProvider } from '@/lib/ai/llm'
import {
  buildCounselorChatService,
  createNullLogger,
  emptyProfile,
  isComplete,
  mergeMessage,
  nextMissingSlot,
  toOverrides,
  type ChatResponse,
  type StudentProfile,
} from '@/lib/ai/chat'

// ── pure slot-filling (no warehouse) ─────────────────────────────────────────
const pq = (o: Partial<ParsedQuery>): ParsedQuery => ({
  raw: '',
  normalized: o.normalized ?? '',
  tokens: [],
  intent: 'unknown',
  intentConfidence: 1,
  entities: [],
  colleges: [],
  hasMultipleColleges: false,
  branch: null,
  community: null,
  studentCutoff: null,
  location: null,
  outOfDomain: null,
  unverifiedCollege: false,
  ...o,
})

describe('StudentProfile — slot filling', () => {
  it('collects cutoff → community → district → branch in order', () => {
    let p = emptyProfile()
    expect(nextMissingSlot(p)).toBe('cutoff')
    p = mergeMessage(p, pq({ studentCutoff: 190 }), '190')
    expect(p.cutoff).toBe(190)
    expect(nextMissingSlot(p)).toBe('community')
    p = mergeMessage(p, pq({ community: 'BC' as CommunityCode }), 'bc')
    expect(nextMissingSlot(p)).toBe('district')
    p = mergeMessage(p, pq({ location: 'coimbatore' }), 'coimbatore')
    expect(p.district).toBe('coimbatore')
    expect(nextMissingSlot(p)).toBe('branch')
    p = mergeMessage(p, pq({ branch: 'Computer Science and Engineering' }), 'cse')
    expect(isComplete(p)).toBe(true)
    expect(nextMissingSlot(p)).toBeNull()
  })

  it('accepts a bare SC/ST when the community slot is being asked', () => {
    let p = mergeMessage(emptyProfile(), pq({ studentCutoff: 190 }), '190') // now expecting community
    p = mergeMessage(p, pq({ community: null }), 'sc') // parser suppresses bare SC without context
    expect(p.community).toBe('SC')
    expect(p.answered.community).toBe(true)
  })

  it('treats "anywhere in Tamil Nadu" as an answered district with no filter', () => {
    let p = mergeMessage(emptyProfile(), pq({ studentCutoff: 190 }), '190')
    p = mergeMessage(p, pq({ community: 'BC' as CommunityCode }), 'bc') // now expecting district
    p = mergeMessage(p, pq({}), 'anywhere in tamil nadu')
    expect(p.answered.district).toBe(true)
    expect(p.district).toBeNull()
  })

  it('treats "I haven\'t decided yet" as an answered branch with no filter', () => {
    let p = emptyProfile()
    p = mergeMessage(p, pq({ studentCutoff: 190 }), '190')
    p = mergeMessage(p, pq({ community: 'BC' as CommunityCode }), 'bc')
    p = mergeMessage(p, pq({ location: 'coimbatore' }), 'coimbatore') // now expecting branch
    p = mergeMessage(p, pq({}), "i haven't decided yet")
    expect(p.answered.branch).toBe(true)
    expect(p.branch).toBeNull()
    expect(isComplete(p)).toBe(true)
  })

  it('maps the profile to query overrides', () => {
    const p: StudentProfile = {
      cutoff: 190,
      community: 'BC' as CommunityCode,
      district: 'coimbatore',
      branch: 'CSE',
      preferredCollege: null,
      answered: { cutoff: true, community: true, district: true, branch: true },
    }
    expect(toOverrides(p)).toEqual({ studentCutoff: 190, community: 'BC', branch: 'CSE', location: 'coimbatore' })
  })
})

// ── end-to-end conversation (real warehouse) ─────────────────────────────────
const DIR = process.env.CYC_DATA_DIR
describe.skipIf(!DIR)('conversation flow (real warehouse)', () => {
  const make = () => {
    let n = 0
    return buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'), // deterministic; no network
      idGenerator: () => `conv-${(n += 1)}`,
    })
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('first conversation asks for the cutoff first', async () => {
    const out = await make().handle({ message: 'hi' })
    expect(b(out).answer).toMatch(/cutoff mark/i)
    expect(b(out).stage).toBe('collecting')
    expect(b(out).profile?.answered.cutoff).toBe(false)
  })

  it('collects the profile in order, then counsels immediately once complete', async () => {
    const svc = make()
    let out = await svc.handle({ message: 'What is the best college?' }) // begins collecting
    const cid = b(out).conversationId
    expect(b(out).answer).toMatch(/cutoff/i)
    out = await svc.handle({ message: '190', conversationId: cid })
    expect(b(out).answer).toMatch(/community/i)
    out = await svc.handle({ message: 'BC', conversationId: cid })
    expect(b(out).answer).toMatch(/district|city/i)
    out = await svc.handle({ message: 'Coimbatore', conversationId: cid })
    expect(b(out).answer).toMatch(/branch/i)
    out = await svc.handle({ message: 'CSE', conversationId: cid })
    // Profile just completed → the counselor gives guidance immediately (not "what would you like to know?").
    expect(b(out).answer).toMatch(/guidance|recommend/i)
    expect(b(out).answer.length).toBeGreaterThan(50)
    expect(b(out).stage).toBe('ready')
    expect(b(out).profile?.complete).toBe(true)
    expect(b(out).confidence).toBe('high') // grounded recommendation, not the low-confidence prompt
  })

  it('asks ONLY the missing slot (cutoff) and never re-asks answered ones', async () => {
    const svc = make()
    const out = await svc.handle({ message: 'BC in Coimbatore for CSE' })
    expect(b(out).answer).toMatch(/cutoff/i)
    expect(b(out).profile?.answered.community).toBe(true)
    expect(b(out).profile?.answered.district).toBe(true)
    expect(b(out).profile?.answered.branch).toBe(true)
    expect(b(out).profile?.answered.cutoff).toBe(false)
  })

  it('recommendation uses the stored profile (district + eligibility) → high confidence', async () => {
    const svc = make()
    let out = await svc.handle({ message: '190 BC Coimbatore CSE' }) // profile complete in one message
    const cid = b(out).conversationId
    expect(b(out).profile?.complete).toBe(true)
    out = await svc.handle({ message: 'What is the best college?', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer.length).toBeGreaterThan(0)
    expect(b(out).confidence).toBe('high') // profile made it district + eligibility constrained
  })

  it('updates the profile when the student changes a value (no re-collection)', async () => {
    const svc = make()
    let out = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'Actually my cutoff is 187', conversationId: cid })
    expect(b(out).profile?.cutoff).toBe(187)
    expect(b(out).answer).toMatch(/updated/i)
    out = await svc.handle({ message: 'I want Chennai instead', conversationId: cid })
    expect(b(out).profile?.district?.toLowerCase()).toBe('chennai')
    expect(b(out).profile?.answered.cutoff).toBe(true) // still answered — not re-asked
  })

  it('persists the profile across turns (never re-asks cutoff/community)', async () => {
    const svc = make()
    let out = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'What are good placements?', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer).not.toMatch(/what is your cutoff|what is your community/i)
  })

  it('compares colleges after the profile is set (no re-collection)', async () => {
    const svc = make()
    let out = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'Compare PSG and CIT', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer).not.toMatch(/what is your cutoff/i)
  })

  it('restart (a new conversation) resets the profile', async () => {
    const svc = make()
    await svc.handle({ message: '190 BC Coimbatore CSE' })
    const fresh = await svc.handle({ message: 'best college?' }) // no conversationId → new session
    expect(fresh.body && (fresh.body as ChatResponse).answer).toMatch(/cutoff/i)
    expect((fresh.body as ChatResponse).profile?.complete).toBe(false)
  })

  it('declines out-of-domain even during collection (no profile trap)', async () => {
    const out = await make().handle({ message: 'MBBS in Chennai' })
    expect(b(out).answer).toMatch(/only support .*engineering counselling/i)
  })

  it('accepts "I haven\'t decided yet" as an answered (no-filter) branch', async () => {
    const svc = make()
    let out = await svc.handle({ message: '180 MBC Chennai' })
    const cid = b(out).conversationId
    expect(b(out).answer).toMatch(/branch/i) // still collecting the branch
    out = await svc.handle({ message: "I haven't decided yet", conversationId: cid })
    expect(b(out).profile?.complete).toBe(true)
    expect(b(out).profile?.branch).toBeNull()
    out = await svc.handle({ message: 'recommend a college', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer.length).toBeGreaterThan(0)
  })

  it('accepts a colloquial district ("Trichy") and resolves it to real colleges', async () => {
    const svc = make() // slot-by-slot, as the collector actually drives it
    let out = await svc.handle({ message: '160' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'ST', conversationId: cid })
    out = await svc.handle({ message: 'Trichy', conversationId: cid }) // nickname, not a canonical district
    expect(b(out).profile?.district).toBe('tiruchirappalli') // aliased to the NIRF spelling
    out = await svc.handle({ message: 'Civil', conversationId: cid })
    expect(b(out).profile?.complete).toBe(true)
    out = await svc.handle({ message: 'best college?', conversationId: cid })
    expect(b(out).confidence).toBe('high') // district resolved → constrained recommendation
  })

  it('"anywhere" district + "haven\'t decided" branch complete with no filters', async () => {
    const svc = make()
    let out = await svc.handle({ message: '120 BC' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'anywhere', conversationId: cid })
    expect(b(out).profile?.answered.district).toBe(true)
    expect(b(out).profile?.district).toBeNull()
    out = await svc.handle({ message: "haven't decided", conversationId: cid })
    expect(b(out).profile?.complete).toBe(true)
    expect(b(out).profile?.branch).toBeNull()
  })
})
