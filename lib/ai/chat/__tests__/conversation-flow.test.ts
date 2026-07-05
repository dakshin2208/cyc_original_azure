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
  resolveDistrict,
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

  it('accepts third-person "he hasn\'t decided" as an undecided branch (parent phrasing)', () => {
    let p = emptyProfile()
    p = mergeMessage(p, pq({ studentCutoff: 178 }), '178')
    p = mergeMessage(p, pq({ community: 'MBC' as CommunityCode }), 'mbc')
    p = mergeMessage(p, pq({}), 'anywhere in tamil nadu') // district
    p = mergeMessage(p, pq({}), "he hasn't decided the branch yet") // was NOT matched before
    expect(p.answered.branch).toBe(true)
    expect(p.branch).toBeNull()
    expect(isComplete(p)).toBe(true)
  })

  it('resolveDistrict: exact, misspelling, and unknown', () => {
    const known = new Set(['coimbatore', 'chennai', 'madurai', 'salem', 'tiruchirappalli'])
    expect(resolveDistrict('coimbatore', known)).toBe('coimbatore')
    expect(resolveDistrict('coimbaore', known)).toBe('coimbatore') // 1 missing letter
    expect(resolveDistrict('CHENNAI', known)).toBe('chennai') // case-insensitive
    expect(resolveDistrict('madurai', known)).toBe('madurai')
    expect(resolveDistrict('zzzzzz', known)).toBeNull() // nothing close → caller broadens
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

  it('collects the profile in order, then shows the summary and invites a question (V2)', async () => {
    const svc = make()
    let out = await svc.handle({ message: 'What is the best college?' }) // begins collecting
    const cid = b(out).conversationId
    expect(b(out).answer).toMatch(/cutoff/i)
    out = await svc.handle({ message: '190', conversationId: cid })
    expect(b(out).answer).toMatch(/community/i)
    out = await svc.handle({ message: 'BC', conversationId: cid })
    expect(b(out).answer).toMatch(/district|location/i)
    out = await svc.handle({ message: 'Coimbatore', conversationId: cid })
    expect(b(out).answer).toMatch(/branch/i)
    out = await svc.handle({ message: 'CSE', conversationId: cid })
    // V2: onboarding complete → confirm the profile and INVITE a question (do NOT auto-answer).
    expect(b(out).answer).toMatch(/your profile/i)
    expect(b(out).answer).toMatch(/ask me anything/i)
    expect(b(out).answer).toMatch(/cutoff: 190/i)
    expect(b(out).stage).toBe('ready')
    expect(b(out).profile?.complete).toBe(true)
    // Now the student asks → the answer uses the stored profile (echoed) and recommends.
    out = await svc.handle({ message: 'Which colleges can I get?', conversationId: cid })
    expect(b(out).answer).toMatch(/based on your profile/i)
    expect(b(out).confidence).toBe('high')
    expect(b(out).answer.length).toBeGreaterThan(50)
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

// ── refinement, exclusion, preference (real warehouse) ───────────────────────
describe.skipIf(!DIR)('counselor refinement & memory (real warehouse)', () => {
  const make = () => {
    let n = 0
    return buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'),
      idGenerator: () => `refine-${(n += 1)}`,
    })
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse
  const complete = async (svc: ReturnType<typeof make>, profile = '190 BC Coimbatore CSE') => {
    const out = await svc.handle({ message: profile })
    return b(out).conversationId as string
  }

  it('shows the onboarding summary (not an auto-answer) when the profile completes (V2)', async () => {
    const out = await make().handle({ message: '190 BC Coimbatore CSE' })
    expect(b(out).answer).toMatch(/your profile/i)
    expect(b(out).answer).toMatch(/ask me anything/i)
    expect(b(out).answer).toMatch(/cutoff: 190/i)
    expect(b(out).answer).toMatch(/community: BC/i)
    expect(b(out).answer).toMatch(/coimbatore/i)
    expect(b(out).stage).toBe('ready')
    expect(b(out).profile?.complete).toBe(true)
  })

  it('"show only government colleges" re-scopes without restarting (#5)', async () => {
    const svc = make()
    const cid = await complete(svc)
    const out = await svc.handle({ message: 'show only government colleges', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer).toMatch(/government/i)
    expect(b(out).answer).not.toMatch(/what is your cutoff/i) // no re-collection
    expect(b(out).profile?.complete).toBe(true) // profile preserved
  })

  it('"private colleges" and "something safer" re-scope the same student (#5)', async () => {
    const svc = make()
    const cid = await complete(svc)
    let out = await svc.handle({ message: 'I want private colleges', conversationId: cid })
    expect(b(out).answer).toMatch(/private option/i)
    out = await svc.handle({ message: 'something safer', conversationId: cid })
    // the eligibility-band view: realistic / safe / ambitious framing
    expect(b(out).answer).toMatch(/realistic|safe|ambitious|reach/i)
  })

  it('remembers an exclusion and keeps applying it across turns (#5)', async () => {
    const svc = make()
    const cid = await complete(svc, '195 MBC Tamil Nadu CSE') // statewide → Anna University surfaces
    let out = await svc.handle({ message: 'remove Anna University', conversationId: cid })
    expect(b(out).answer).toMatch(/taken Anna University off|off your list/i)
    // the recommendations themselves (after the confirming intro line) drop it
    expect(b(out).answer.split('\n').slice(1).join('\n')).not.toMatch(/Anna University/)
    // exclusion persists into a later, independent recommendation request (memory)
    out = await svc.handle({ message: 'show me the best colleges', conversationId: cid })
    expect(b(out).answer).not.toMatch(/Anna University/)
  })

  it('changes a slot phrased as a question ("switch to ECE") and remembers it (#5)', async () => {
    const svc = make()
    const cid = await complete(svc)
    const out = await svc.handle({ message: 'switch to ECE instead', conversationId: cid })
    expect(b(out).answer).toMatch(/updated/i)
    expect(b(out).profile?.branch).toMatch(/electronic/i) // ECE remembered, not reverted to CSE
  })

  it('is honest that fees/hostel are not in the dataset (#5)', async () => {
    const svc = make()
    const cid = await complete(svc)
    let out = await svc.handle({ message: 'cheaper options', conversationId: cid })
    expect(b(out).answer).toMatch(/fee/i)
    expect(b(out).answer).toMatch(/government/i) // steers to the affordable set we DO have
    out = await svc.handle({ message: 'what about hostel facilities', conversationId: cid })
    expect(b(out).answer).toMatch(/hostel|campus/i)
    expect(b(out).answer).toMatch(/don't have|can't compare/i)
  })

  it('answers "Does <college> have hostels/fees/recruiters?" honestly, not "couldn\'t verify"', async () => {
    const svc = make()
    const cid = await complete(svc)
    // A real college wrapped in a "Does X have…?" question must resolve (parser fix) and
    // get an honest missing-data answer — never the "couldn't verify that college" decline.
    let out = await svc.handle({ message: 'Does Kumaraguru College of Technology have hostel facilities?', conversationId: cid })
    expect(b(out).answer).not.toMatch(/couldn't verify/i)
    expect(b(out).answer).toMatch(/hostel|campus/i)
    expect(b(out).profile?.branch).toMatch(/computer/i) // a question never mutated the profile
    out = await svc.handle({ message: 'What is the fee at PSG College of Technology?', conversationId: cid })
    expect(b(out).answer).not.toMatch(/couldn't verify/i)
    expect(b(out).answer).toMatch(/fee/i)
    out = await svc.handle({ message: 'which companies recruit at Coimbatore Institute of Technology', conversationId: cid })
    expect(b(out).answer).not.toMatch(/couldn't verify/i)
    expect(b(out).answer).toMatch(/recruit|compan|salary|placement/i)
  })

  it('cleanly renders a single named college with no dangling reasoning (formatter fix)', async () => {
    // A query that yields a top pick with no substantive reason must NOT double the
    // name ("PSG — PSG:"); the reasoning is simply omitted.
    const out = await make().handle({ message: 'Tell me about PSG College of Technology' })
    expect(b(out).answer).not.toMatch(/([A-Z][\w. ]+) — \1:/) // "Name — Name:"
    expect(b(out).answer).not.toMatch(/ — \.\s|—\s*$/) // no dangling "— ."
  })

  it('a parent using third person ("he hasn\'t decided") completes onboarding → summary (V2)', async () => {
    const svc = make()
    let out = await svc.handle({ message: 'I am looking for a college for my son, he got 178 cutoff' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: 'MBC', conversationId: cid })
    out = await svc.handle({ message: 'anywhere in Tamil Nadu', conversationId: cid })
    out = await svc.handle({ message: "he hasn't decided the branch yet", conversationId: cid })
    expect(b(out).profile?.complete).toBe(true)
    expect(b(out).profile?.branch).toBeNull() // third-person "hasn't decided" recognised
    expect(b(out).answer).toMatch(/your profile/i) // onboarding summary
    expect(b(out).answer).toMatch(/branch: undecided/i)
  })

  it('answers a third-person eligibility question with the band view, never "share your cutoff"', async () => {
    const svc = make()
    const cid = await complete(svc, '178 MBC Tamil Nadu CSE')
    const out = await svc.handle({ message: 'will he definitely get a seat somewhere?', conversationId: cid })
    expect(b(out).answer).not.toMatch(/share your cutoff|don't have enough to go on/i)
    expect(b(out).answer).toMatch(/safe|realistic|ambitious|balanced|choices/i)
  })

  it('asks for a full name when a comparison names an unresolvable abbreviation', async () => {
    const svc = make()
    const cid = await complete(svc, '182 BC Chennai ECE')
    const out = await svc.handle({ message: 'compare SSN and Sri Venkateswara College of Engineering', conversationId: cid })
    expect(b(out).answer).toMatch(/full name|could only identify|abbreviation/i)
    expect(b(out).answer).not.toMatch(/my top recommendation/i) // must not silently recommend one
  })

  it('routes a stated priority ("I care most about placements") to the engine (#3)', async () => {
    const svc = make()
    const cid = await complete(svc)
    const out = await svc.handle({ message: 'I care most about placements', conversationId: cid })
    expect(b(out).stage).toBe('ready')
    expect(b(out).answer).toMatch(/placement/i)
    expect(b(out).answer).not.toMatch(/what matters most/i) // acted on the priority, didn't re-ask
  })

  it('never invents a college for a deictic "recruit there" question', async () => {
    const svc = make()
    const cid = await complete(svc, '150 BC Salem Mechanical')
    const out = await svc.handle({ message: 'which companies recruit there', conversationId: cid })
    expect(b(out).answer).toMatch(/recruiter|company|companies|salary|placement/i)
    expect(b(out).answer).not.toMatch(/Theresa/i) // "there" must not fuzzy-match a college
  })

  it('a complete profile is never told "share your cutoff" on a vague message', async () => {
    const svc = make()
    const cid = await complete(svc)
    const out = await svc.handle({ message: '???', conversationId: cid })
    expect(b(out).answer).not.toMatch(/share your cutoff|don't have enough to go on/i)
    expect(b(out).answer).toMatch(/which colleges can i get|compare|placements|widen/i)
  })

  it('resolves a colloquial district ("Trichy") inside a bulk one-shot profile', async () => {
    const svc = make()
    const out = await svc.handle({ message: '170 MBC Trichy Civil' })
    expect(b(out).profile?.complete).toBe(true)
    expect(b(out).profile?.district).toBe('tiruchirappalli')
  })

  it('a bare question after completion never re-collects or mutates the profile', async () => {
    const svc = make()
    const cid = await complete(svc)
    const out = await svc.handle({ message: 'which has the best placements?', conversationId: cid })
    expect(b(out).profile?.cutoff).toBe(190) // untouched
    expect(b(out).profile?.branch).toMatch(/computer/i) // still CSE
    expect(b(out).answer).not.toMatch(/what is your cutoff/i)
  })
})

// ── AI Counselor V2 — structured onboarding, end to end (real warehouse) ─────
describe.skipIf(!DIR)('AI Counselor V2 onboarding', () => {
  const make = () => {
    let n = 0
    return buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'),
      idGenerator: () => `v2-${(n += 1)}`,
    })
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse

  it('✓ New conversation: greets and asks the cutoff first (does NOT answer immediately)', async () => {
    const out = await make().handle({ message: 'hi' })
    expect(b(out).answer).toMatch(/welcome to chooseyourcollege ai counselor/i)
    expect(b(out).answer).toMatch(/what is your cutoff mark/i)
    expect(b(out).stage).toBe('collecting')
  })

  it('✓ Onboarding asks ONE question at a time, in order, with MBC/DNC option', async () => {
    const svc = make()
    let out = await svc.handle({ message: 'hi' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: '190', conversationId: cid })
    expect(b(out).answer).toMatch(/which community do you belong to/i)
    expect(b(out).answer).toMatch(/MBC\/DNC/)
    out = await svc.handle({ message: 'BC', conversationId: cid })
    expect(b(out).answer).toMatch(/district or location/i)
    out = await svc.handle({ message: 'Coimbatore', conversationId: cid })
    expect(b(out).answer).toMatch(/engineering branch/i)
  })

  it('✓ Complete onboarding → profile summary + "ask me anything" (no auto-answer)', async () => {
    const out = await make().handle({ message: '190 BC Coimbatore CSE' })
    expect(b(out).answer).toMatch(/your profile/i)
    expect(b(out).answer).toMatch(/cutoff: 190/i)
    expect(b(out).answer).toMatch(/community: BC/i)
    expect(b(out).answer).toMatch(/preferred location: coimbatore/i)
    expect(b(out).answer).toMatch(/perfect! now ask me anything/i)
    expect(b(out).profile?.complete).toBe(true)
  })

  it('✓ Partial onboarding → asks only the next missing slot (does not restart)', async () => {
    const svc = make()
    const out = await svc.handle({ message: 'I have 190 cutoff, BC' }) // cutoff+community only
    expect(b(out).profile?.answered.cutoff).toBe(true)
    expect(b(out).profile?.answered.community).toBe(true)
    expect(b(out).answer).toMatch(/district or location/i) // asks the next slot, not cutoff again
  })

  it('✓ Missing branch: asks ONLY for the branch, not the whole onboarding', async () => {
    const svc = make()
    let out = await svc.handle({ message: '190 BC Coimbatore' }) // branch missing
    const cid = b(out).conversationId
    expect(b(out).answer).toMatch(/engineering branch/i)
    out = await svc.handle({ message: 'suggest colleges', conversationId: cid }) // still no branch
    expect(b(out).answer).toMatch(/engineering branch/i) // asks branch only
    expect(b(out).answer).not.toMatch(/what is your cutoff/i) // never restarts
  })

  it('✓ Session memory: the stored profile is echoed and used on every answer', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: 'Which college has the best placements?', conversationId: cid })
    expect(b(out).answer).toMatch(/based on your profile/i)
    expect(b(out).answer).toMatch(/190/)
    expect(b(out).answer).toMatch(/coimbatore/i)
    expect(b(out).profile?.cutoff).toBe(190) // never asked again
  })

  it('✓ Change location only: "I want Chennai" updates location, keeps the rest', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: 'I changed my mind. I want Chennai', conversationId: cid })
    expect(b(out).profile?.district?.toLowerCase()).toBe('chennai')
    expect(b(out).profile?.cutoff).toBe(190) // unchanged
    expect(b(out).profile?.community).toBe('BC') // unchanged
    expect(b(out).profile?.branch).toMatch(/computer/i) // unchanged
    expect(b(out).answer).not.toMatch(/what is your cutoff|which community/i) // no re-onboarding
  })

  it('✓ Change branch only: "switch to ECE" updates branch, keeps the rest', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: 'switch to ECE', conversationId: cid })
    expect(b(out).profile?.branch).toMatch(/electronic/i)
    expect(b(out).profile?.cutoff).toBe(190) // unchanged
    expect(b(out).profile?.district?.toLowerCase()).toBe('coimbatore') // unchanged
  })

  it('✓ Recommendation after onboarding uses warehouse data (real colleges, no invention)', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: 'Which colleges can I get?', conversationId: cid })
    expect(b(out).answer).toMatch(/kumaraguru|coimbatore institute|psg|government college/i) // real warehouse colleges
    expect(b(out).confidence).toBe('high')
  })

  it('✓ Follow-up questions never re-collect the profile', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    for (const q of ['show government colleges', 'compare PSG College of Technology and Kumaraguru College of Technology', 'something safer']) {
      const out = await svc.handle({ message: q, conversationId: cid })
      expect(b(out).answer).not.toMatch(/what is your cutoff|which community do you belong/i)
      expect(b(out).profile?.complete).toBe(true)
    }
  })

  it('✓ ANSWERS every counselling ask with real colleges — never deflects (the objective)', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    // Generic / keyword-free / misspelled asks must all return warehouse colleges.
    for (const q of ['give me colleges', 'give me the college name', 'any college', 'any collage', 'college names with my cutoff', 'options for me']) {
      const out = await svc.handle({ message: q, conversationId: cid })
      expect(b(out).answer, `"${q}" should answer with colleges`).toMatch(/based on your profile/i)
      expect(b(out).answer).not.toMatch(/couldn't verify|happy to help further|what would help most/i)
      expect(b(out).answer.length).toBeGreaterThan(60)
    }
  })

  it('✓ different questions get DIFFERENT data-grounded answers (not one canned fallback)', async () => {
    const svc = make()
    const first = await svc.handle({ message: '185 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const tiers = b(await svc.handle({ message: 'what are my dream, target and safe colleges?', conversationId: cid })).answer
    const compare = b(await svc.handle({ message: 'compare PSG College of Technology vs Coimbatore Institute of Technology', conversationId: cid })).answer
    const placements = b(await svc.handle({ message: 'which college has the best placements?', conversationId: cid })).answer
    // Tier query → the safe/target/dream band view (not the generic "details saved" loop).
    expect(tiers).toMatch(/safe choices|balanced|ambitious|realistic/i)
    expect(tiers).not.toMatch(/i have your details saved|what would help most/i)
    // Comparison → a head-to-head (distinct from the tier answer).
    expect(compare).toMatch(/compare|lean towards|★/i)
    // Placements → a placement-ranked answer with a real figure.
    expect(placements).toMatch(/placement/i)
    expect(placements).toMatch(/\d/) // a real number (salary / %)
    // The three answers are genuinely different.
    expect(tiers).not.toBe(compare)
    expect(compare).not.toBe(placements)
  })

  it('✓ a pure social message ("thanks") gets a nudge, not a recommendation', async () => {
    const svc = make()
    const first = await svc.handle({ message: '190 BC Coimbatore CSE' })
    const cid = b(first).conversationId
    const out = await svc.handle({ message: 'thanks', conversationId: cid })
    expect(b(out).answer).toMatch(/happy to help/i)
    expect(b(out).answer).not.toMatch(/my top recommendation/i)
  })

  it('✓ a MISSPELLED district ("coimbaore") still returns real colleges', async () => {
    const svc = make()
    let out = await svc.handle({ message: 'hi' })
    const cid = b(out).conversationId
    out = await svc.handle({ message: '170', conversationId: cid })
    out = await svc.handle({ message: 'BC', conversationId: cid })
    out = await svc.handle({ message: 'coimbaore', conversationId: cid }) // misspelled Coimbatore
    out = await svc.handle({ message: 'CSE', conversationId: cid })
    expect(b(out).profile?.district).toBe('coimbatore') // fuzzy-normalized
    // and even an awkward phrasing that doesn't parse to an intent still answers
    for (const q of ['tell me the collage what i get', 'suggest me the collage', 'which collage i get']) {
      out = await svc.handle({ message: q, conversationId: cid })
      expect(b(out).answer, `"${q}"`).toMatch(/based on your profile/i)
      expect(b(out).answer).not.toMatch(/couldn't find|what would help most|widen the search/i)
      expect(b(out).answer).toMatch(/college|technology|institute|engineering/i) // real college names
    }
  })
})
