/**
 * @module lib/ai/chat/__tests__/conversation-memory.test
 *
 * Conversational memory: the counsellor remembers what it was just discussing, so a parent can
 * say "is IT realistic for him?" or "compare the top two YOU JUST MENTIONED" and be understood.
 *
 * THE SAFETY PROPERTY UNDER TEST, as much as the feature itself: a pronoun is NEVER fed to the
 * fuzzy college matcher. We resolve a reference by REWRITING the message with the remembered
 * CANONICAL name before parsing, so the matcher only ever sees an exact name. Resolving "it" by
 * handing the matcher a weak signal would re-open the phantom-college bug ("my SON" → Sona
 * College) at industrial scale — so every ambiguous case here must fall back to ASKING, never
 * to guessing.
 */

import { describe, expect, it } from 'vitest'
import { createUnavailableProvider } from '@/lib/ai/llm'
import { applyTurn, createConversationState, type ContextPackage, type ParsedQuery } from '@/lib/ai/orchestration'
import { sessionId } from '@/lib/ai/shared'
import {
  buildCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  EMPTY_MEMORY,
  readMemory,
  resolveReference,
  type ChatResponse,
  type SessionStore,
  type ProfileStore,
} from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

const KUMARAGURU = 'Kumaraguru College of Technology'
const PSG = 'PSG College of Technology'

// ── pure unit tests: the ambiguity rules (no warehouse) ──────────────────────
const pq = (colleges: readonly string[]): ParsedQuery =>
  ({ colleges, raw: '', normalized: '', tokens: [], intent: 'unknown', intentConfidence: 1, entities: [],
     hasMultipleColleges: colleges.length > 1, branch: null, community: null, studentCutoff: null,
     location: null, outOfDomain: null, unverifiedCollege: false }) as ParsedQuery

const mem = (last: string | null, set: readonly string[] = []) => ({ lastDiscussedCollege: last, lastRecommendedSet: set })

describe('resolveReference — resolve by rewriting, or ask; never guess', () => {
  it('✓ "it" → the remembered canonical name, substituted into the text', () => {
    expect(resolveReference('is it realistic for him?', pq([]), mem(KUMARAGURU)))
      .toBe(`is ${KUMARAGURU} realistic for him?`)
  })

  it('✓ "there" is locative → "at <College>"', () => {
    expect(resolveReference('what are the hostel fees there?', pq([]), mem(KUMARAGURU)))
      .toBe(`what are the hostel fees at ${KUMARAGURU}?`)
  })

  it('✓ "compare the top two you just mentioned" → the exact two last shown', () => {
    expect(resolveReference('compare the top two you just mentioned', pq([]), mem(null, [PSG, KUMARAGURU])))
      .toBe(`compare ${PSG} and ${KUMARAGURU}`)
  })

  // ── the ambiguous cases: every one of these must return null (= ask, don't guess) ──
  it('✗ a deictic with NOTHING remembered → no rewrite (the counsellor asks which college)', () => {
    expect(resolveReference('is it realistic for him?', pq([]), EMPTY_MEMORY)).toBeNull()
  })

  it('✗ "compare the top two" with fewer than two remembered → no rewrite (asks for both names)', () => {
    expect(resolveReference('compare the top two', pq([]), mem(KUMARAGURU, [KUMARAGURU]))).toBeNull()
  })

  it('✗ a message that ALREADY names a college is never rewritten', () => {
    expect(resolveReference('is it better than PSG?', pq([PSG]), mem(KUMARAGURU))).toBeNull()
  })

  it('✗ existential "there" is not a place ("is there a hostel")', () => {
    expect(resolveReference('is there a hostel?', pq([]), mem(KUMARAGURU))).toBeNull()
  })

  it('✗ "IT" in a BRANCH question is the branch, not a pronoun — left alone', () => {
    expect(resolveReference('is it a good branch?', pq([]), mem(KUMARAGURU))).toBeNull()
  })

  it('✗ bare "that" as a conjunction is not a reference', () => {
    expect(resolveReference('I heard that placements are good', pq([]), mem(KUMARAGURU))).toBeNull()
  })
})

describe('applyTurn — memory is only ever written from RESOLVED, real colleges', () => {
  const ctx = (recommendations: readonly { college: { name: string } }[] = []): ContextPackage =>
    ({ recommendations, comparison: null, facts: [], evidence: [], subjects: [], followUpQuestions: [], extraNotes: [] }) as unknown as ContextPackage

  it('✓ a turn naming ONE college sets it as the antecedent', () => {
    const s = applyTurn(createConversationState(sessionId('s')), pq([KUMARAGURU]), ctx())
    expect(s.lastDiscussedCollege).toBe(KUMARAGURU)
  })

  it('✓ a recommendation turn remembers its TOP PICK, and the whole ordered set', () => {
    const s = applyTurn(createConversationState(sessionId('s')), pq([]), ctx([{ college: { name: PSG } }, { college: { name: KUMARAGURU } }]))
    expect(s.lastDiscussedCollege).toBe(PSG)
    expect(s.previousRecommendations).toEqual([PSG, KUMARAGURU])
  })

  it('✓ a COMPARISON turn (two colleges) does NOT silently pick one', () => {
    // "compare A and B" then "is it good?" is genuinely ambiguous. The antecedent is left as it
    // was — with nothing prior, it stays null and the counsellor asks.
    const s = applyTurn(createConversationState(sessionId('s')), pq([PSG, KUMARAGURU]), ctx())
    expect(s.lastDiscussedCollege).toBeNull()
  })

  it('✓ a turn naming nothing keeps the prior antecedent (memory persists across chit-chat)', () => {
    const first = applyTurn(createConversationState(sessionId('s')), pq([KUMARAGURU]), ctx())
    const second = applyTurn(first, pq([]), ctx())
    expect(second.lastDiscussedCollege).toBe(KUMARAGURU)
  })

  it('✓ readMemory is defensive about rows written before the field existed', () => {
    const legacy = { ...createConversationState(sessionId('s')), lastDiscussedCollege: undefined } as never
    expect(readMemory(legacy).lastDiscussedCollege).toBeNull() // → the counsellor asks, never crashes
    expect(readMemory(undefined)).toEqual(EMPTY_MEMORY)
  })
})

// ── end-to-end, on ONE conversation, production wiring, no API key ───────────
describe.skipIf(!DIR)('conversational memory (real warehouse, deterministic)', () => {
  const make = (sessionStore?: SessionStore, profileStore?: ProfileStore) =>
    buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'),
      ...(sessionStore ? { sessionStore } : {}),
      ...(profileStore ? { profileStore } : {}),
    })
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('✓ "is kumaraguru good?" → "is it realistic for him?" is answered ABOUT Kumaraguru', async () => {
    const svc = make()
    const t1 = b(await svc.handle({ message: 'is kumaraguru good?' }))
    const cid = t1.conversationId
    const t2 = b(await svc.handle({ message: 'is it realistic for him?', conversationId: cid }))

    expect(t2.answer).toMatch(/Kumaraguru College of Technology/i) // "it" resolved
    expect(t2.answer).not.toMatch(/which college|what is your cutoff/i) // not a re-ask
    expect(t2.answer).not.toMatch(/Sona|Nachimuthu|Ponjesly/i) // no phantom, ever
  })

  it('✓ a real list → "compare the top two you just mentioned" compares THOSE two, by name', async () => {
    const svc = make()
    const first = b(await svc.handle({ message: '168 BC Coimbatore' }))
    const cid = first.conversationId
    const list = b(await svc.handle({ message: 'what about colleges with better placements?', conversationId: cid }))

    // The two the assistant actually led with, taken from its own answer.
    const top = (list.answer ?? '').match(/My top recommendation is ([^—]+) —/)?.[1].trim()
    const second = (list.answer ?? '').match(/^\s*•\s*([^—]+) —/m)?.[1].trim()
    expect(top).toBeTruthy()
    expect(second).toBeTruthy()

    const cmp = b(await svc.handle({ message: 'compare the top two you just mentioned', conversationId: cid }))
    expect(cmp.answer).toMatch(/compare|lean towards|★/i) // it IS a comparison
    expect(cmp.answer).toMatch(new RegExp(top!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    expect(cmp.answer).toMatch(new RegExp(second!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    expect(cmp.answer).not.toMatch(/give me both full names|which two/i) // never asks again
  })

  it('✓ "what are the hostel fees there?" declines for THAT college, by name', async () => {
    const svc = make()
    const t1 = b(await svc.handle({ message: 'is kumaraguru good?' }))
    const out = b(await svc.handle({ message: 'what are the hostel fees there?', conversationId: t1.conversationId }))
    expect(out.answer).toMatch(/Kumaraguru College of Technology/i) // "there" resolved
    expect(out.answer).toMatch(/don'?t have|won'?t guess/i) // still an honest decline
    expect(out.answer).not.toMatch(/₹\s?[\d,]+\s*(per|\/)?\s*(year|month|sem)/i) // no invented fee
  })

  it('✓ AMBIGUITY: "is it realistic for him?" with NO prior college asks — and invents nothing', async () => {
    const svc = make()
    const out = b(await svc.handle({ message: 'is it realistic for him?' })) // first turn, no memory
    expect(out.answer).not.toMatch(/Sona|Nachimuthu|Ponjesly|Kumaraguru/i) // no college conjured
    expect(out.profile?.preferredCollege ?? null).toBeNull()
  })

  it('✓ AMBIGUITY: "compare the top two" with no prior recommendation asks for both names', async () => {
    const svc = make()
    const out = b(await svc.handle({ message: 'compare the top two' }))
    expect(out.answer).toMatch(/give me both full names|other one's full name/i) // the existing path
  })

  it('✓ PERSISTENCE: memory is read from the STORE — a fresh service instance still resolves "it"', async () => {
    // Two service instances, one shared store pair: this is the multi-replica case. If memory
    // lived in a process-local Map (like the turn-text history does), this test would fail.
    const sessions = createInMemorySessionStore()
    const profiles = createInMemoryProfileStore()
    const replicaA = make(sessions, profiles)
    const replicaB = make(sessions, profiles) // a DIFFERENT process would see exactly this

    const t1 = b(await replicaA.handle({ message: 'is kumaraguru good?' }))
    const t2 = b(await replicaB.handle({ message: 'is it realistic for him?', conversationId: t1.conversationId }))
    expect(t2.answer).toMatch(/Kumaraguru College of Technology/i)
  })

  it('✓ PHANTOM GUARD: a message naming no college never stores one as the antecedent', async () => {
    const sessions = createInMemorySessionStore()
    const svc = make(sessions)
    const t1 = b(await svc.handle({ message: "my son got 168 cutoff, he's BC, we're in Coimbatore" }))
    const state = await sessions.get(t1.conversationId)

    // "my son" must not have become Sona College — not in the profile, not in memory.
    expect(t1.profile?.preferredCollege ?? null).toBeNull()
    expect(state?.lastDiscussedCollege ?? '').not.toMatch(/Sona|Nachimuthu/i)
    expect((state?.mentionedColleges ?? []).join(' ')).not.toMatch(/Sona|Nachimuthu/i)
  })
})
