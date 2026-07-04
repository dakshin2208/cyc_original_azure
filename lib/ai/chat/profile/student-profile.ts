/**
 * @module lib/ai/chat/profile/student-profile
 *
 * The StudentProfile — the minimum information a counselor collects before advising
 * (cutoff, community, district, branch, and an optional preferred college). Pure,
 * session-persisted data + the deterministic slot-filling helpers the conversational
 * layer uses. No AI, no recommendation logic (that stays in the engine).
 */

import { normalizeCommunity, type CommunityCode } from '@/lib/knowledge'
import type { ParsedQuery, QueryOverrides } from '@/lib/ai/orchestration'

/** The required slots, in the order they are collected. */
export const PROFILE_SLOTS = ['cutoff', 'community', 'district', 'branch'] as const
export type ProfileSlot = (typeof PROFILE_SLOTS)[number]

/** The student profile, persisted per conversation. */
export interface StudentProfile {
  readonly cutoff: number | null
  readonly community: CommunityCode | null
  /** Specific district, or `null` after answering = "anywhere in Tamil Nadu". */
  readonly district: string | null
  /** Canonical branch, or `null` after answering = "undecided". */
  readonly branch: string | null
  readonly preferredCollege: string | null
  /** Slots the student has explicitly answered (so we never re-ask). */
  readonly answered: Readonly<Record<ProfileSlot, boolean>>
}

/** A serializable view for the UI (checklist + values). */
export interface StudentProfileView {
  readonly cutoff: number | null
  readonly community: string | null
  readonly district: string | null
  readonly branch: string | null
  readonly preferredCollege: string | null
  readonly answered: Readonly<Record<ProfileSlot, boolean>>
  readonly complete: boolean
}

export function emptyProfile(): StudentProfile {
  return {
    cutoff: null,
    community: null,
    district: null,
    branch: null,
    preferredCollege: null,
    answered: { cutoff: false, community: false, district: false, branch: false },
  }
}

export function isComplete(p: StudentProfile): boolean {
  return PROFILE_SLOTS.every((s) => p.answered[s])
}

export function nextMissingSlot(p: StudentProfile): ProfileSlot | null {
  return PROFILE_SLOTS.find((s) => !p.answered[s]) ?? null
}

export function profilesEqual(a: StudentProfile, b: StudentProfile): boolean {
  return (
    a.cutoff === b.cutoff &&
    a.community === b.community &&
    a.district === b.district &&
    a.branch === b.branch &&
    a.preferredCollege === b.preferredCollege &&
    PROFILE_SLOTS.every((s) => a.answered[s] === b.answered[s])
  )
}

// "Anywhere" (district) and "undecided" (branch), plus state-name tokens that mean
// "no district preference" rather than a literal district. Matched against the RAW
// (lowercased) message — the parser's normalizer turns "haven't" into "haven t".
const STATE_TOKENS = new Set(['tamil nadu', 'tamilnadu', 'tn'])
const ANYWHERE = /\banywhere\b|\bany (district|city|where|place|location)\b|\bno preference\b|\btamil ?nadu\b|\ball over\b/i
const UNDECIDED = /haven'?t decided|not decided|undecided|not sure|any branch|open to|no preference|don'?t know|any course|not yet/i

// Common colloquial district names → the canonical NIRF spelling (lowercased; the
// district filter compares case-insensitively). Lets a student say "Trichy".
const DISTRICT_ALIASES: Readonly<Record<string, string>> = {
  trichy: 'tiruchirappalli',
  tiruchi: 'tiruchirappalli',
  madras: 'chennai',
  tuticorin: 'thoothukudi',
  nagercoil: 'kanyakumari',
  ooty: 'the nilgiris',
  nilgiris: 'the nilgiris',
  kanchipuram: 'kancheepuram',
}

// A bare place name the parser didn't recognize (so we still fill the district slot
// we explicitly asked for): 1–3 alphabetic words, not a question or an escape phrase.
const PLACE_RE = /^[a-z][a-z .'-]{1,28}$/
const looksLikePlace = (t: string): boolean =>
  PLACE_RE.test(t) && t.split(' ').length <= 3 && !ANYWHERE.test(t) && !UNDECIDED.test(t)

/**
 * Merge a parsed message into the profile, honoring the slot currently being asked.
 * `raw` is the original message text (used for phrasing-sensitive matches like
 * "anywhere"/"haven't decided" and bare slot answers). A value the message states
 * always sticks; "anywhere"/"undecided" answer (and clear) the district/branch slots.
 * Never re-asks an answered slot.
 */
export function mergeMessage(prior: StudentProfile, parsed: ParsedQuery, raw: string): StudentProfile {
  const answered = { ...prior.answered }
  let { cutoff, community, district, branch, preferredCollege } = prior
  const expecting = nextMissingSlot(prior)
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim()

  if (parsed.studentCutoff !== null) {
    cutoff = parsed.studentCutoff
    answered.cutoff = true
  }
  if (parsed.community !== null) {
    community = parsed.community
    answered.community = true
  }
  // The parser suppresses a bare SC/ST without context; accept it when we asked.
  if (!answered.community && expecting === 'community') {
    const code = normalizeCommunity(text)
    if (code) {
      community = code
      answered.community = true
    }
  }
  if (parsed.branch !== null) {
    branch = parsed.branch
    answered.branch = true
  }
  if (parsed.location !== null) {
    if (STATE_TOKENS.has(parsed.location.toLowerCase())) district = null // state = "anywhere"
    else district = parsed.location
    answered.district = true
  }
  if (parsed.colleges.length > 0) preferredCollege = parsed.colleges[0]

  // Context-sensitive answers for the district slot we just asked: "anywhere" clears
  // it; an unrecognized bare place name is accepted (aliased to the canonical spelling).
  if (expecting === 'district' && !answered.district) {
    if (ANYWHERE.test(text)) {
      district = null
      answered.district = true
    } else if (looksLikePlace(text)) {
      district = DISTRICT_ALIASES[text] ?? text
      answered.district = true
    }
  }
  if (expecting === 'branch' && !answered.branch && UNDECIDED.test(text)) {
    branch = null
    answered.branch = true
  }

  return { cutoff, community, district, branch, preferredCollege, answered }
}

/** The profile as query overrides that fill fields a later message omits. */
export function toOverrides(p: StudentProfile): QueryOverrides {
  return { studentCutoff: p.cutoff, community: p.community, branch: p.branch, location: p.district }
}

export function toView(p: StudentProfile): StudentProfileView {
  return {
    cutoff: p.cutoff,
    community: p.community,
    district: p.district,
    branch: p.branch,
    preferredCollege: p.preferredCollege,
    answered: p.answered,
    complete: isComplete(p),
  }
}

/** The prompt asked to fill a missing slot. */
export function slotPrompt(slot: ProfileSlot): string {
  switch (slot) {
    case 'cutoff':
      return 'What is your cutoff mark?'
    case 'community':
      return 'What is your community?\n• OC\n• BC\n• BCM\n• MBC\n• SC\n• SCA\n• ST'
    case 'district':
      return 'Which district or city are you interested in?\nExamples: Coimbatore, Chennai, Madurai, Salem\n\nor say "Anywhere in Tamil Nadu".'
    case 'branch':
      return 'Which branch are you interested in?\nExamples: CSE, AI & DS, ECE, EEE, Mechanical, Civil, IT, Biotech\n\nor say "I haven\'t decided yet".'
  }
}

/** A human-readable profile-complete checklist. */
export function profileSummary(p: StudentProfile): string {
  return [
    `✓ Cutoff: ${p.cutoff !== null ? p.cutoff : '—'}`,
    `✓ Community: ${p.community ?? '—'}`,
    `✓ District: ${p.district ?? 'Anywhere in Tamil Nadu'}`,
    `✓ Branch: ${p.branch ?? 'Undecided'}`,
  ].join('\n')
}
