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

/**
 * The slots that genuinely GATE counselling: cutoff + community determine eligibility, so
 * nothing realistic can be said without them. District and branch are REFINEMENTS — the
 * recommendation engine ranks across all branches when `branch` is null (it reports "any
 * branch"), so a parent who gives rank + community + city must get colleges, never a fourth
 * "which branch?" prompt.
 */
export const REQUIRED_SLOTS = ['cutoff', 'community'] as const

/** Whether the profile is complete ENOUGH to counsel (cutoff + community). */
export function isComplete(p: StudentProfile): boolean {
  return REQUIRED_SLOTS.every((s) => p.answered[s])
}

/** The next REQUIRED slot still missing — the only thing that may block an answer. */
export function nextMissingRequiredSlot(p: StudentProfile): ProfileSlot | null {
  return REQUIRED_SLOTS.find((s) => !p.answered[s]) ?? null
}

/**
 * The next unanswered slot in the onboarding walk (including the optional district/branch).
 * Used to gather refinements progressively — never to block a question.
 */
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
const ANYWHERE =
  /\banywhere\b|\bany (district|city|where|place|location)\b|\bno (preference|specific|particular)\b|\bdoesn'?t matter\b|\btamil ?nadu\b|\ball over\b/i
// Undecided branch — accepts first- AND third-person phrasing, because a PARENT often
// answers for the student ("he hasn't decided", "she doesn't mind", "not sure yet").
const UNDECIDED =
  /\b(haven'?t|hasn'?t|have not|has not|not|never|didn'?t) (decided|chosen|fixed|picked|sure|thought)\b|\bundecided\b|\bnot sure\b|\bany (branch|stream|course|department)\b|\bopen to (any|anything|all|options)\b|\bno (preference|specific|particular)\b|\bdon'?t (know|mind|care)\b|\bdoesn'?t (know|mind|care|matter)\b|\bnot yet\b|\bno idea\b|\bflexible\b|\bwhatever\b/i

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
  } else if (!answered.district) {
    // Colloquial district nickname the parser doesn't resolve ("Trichy", "Madras") —
    // recognized here so it also works in a bulk message ("170 MBC Trichy Civil"), not
    // only when the district slot is the one being asked.
    const aliasTok = Object.keys(DISTRICT_ALIASES).find((a) => text.split(' ').includes(a))
    if (aliasTok) {
      district = DISTRICT_ALIASES[aliasTok]
      answered.district = true
    }
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
      return 'Which community do you belong to?\n• OC\n• BC\n• BCM\n• MBC/DNC\n• SC\n• SCA\n• ST'
    case 'district':
      return 'Which district or location do you prefer?\nExamples: Coimbatore, Chennai, Madurai, Salem\n\nor say "Anywhere in Tamil Nadu".'
    case 'branch':
      return 'Which engineering branch are you interested in?\nExamples: CSE, AI & DS, IT, ECE, EEE, Mechanical, Civil\n\nor say "I haven\'t decided yet".'
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

/**
 * The V2 onboarding hand-off, shown ONCE when the four slots are complete: confirm
 * the collected profile, then invite the student's question (we do NOT auto-answer —
 * the student asks next).
 */
export function onboardingSummary(p: StudentProfile): string {
  return [
    'Your Profile',
    '',
    `Cutoff: ${p.cutoff !== null ? p.cutoff : '—'}`,
    `Community: ${p.community ?? '—'}`,
    `Preferred Location: ${titleCasePlace(p.district) ?? 'Anywhere in Tamil Nadu'}`,
    `Branch: ${p.branch ?? 'Undecided'}`,
    '',
    'Perfect! Now ask me anything about engineering counselling.',
    '',
    'Examples:',
    '• Which colleges can I get?',
    '• Compare PSG vs CIT',
    '• Which college has the best placements?',
    '• What are my dream, target and safe colleges?',
  ].join('\n')
}

/**
 * A compact one-line echo of the stored profile an answer is based on — so the student
 * can see their onboarding details are being used (and never has to repeat them).
 */
export function profileEcho(p: StudentProfile): string {
  // Intent-first: with NOTHING collected there is no profile to echo — emitting
  // "Based on your profile — Cutoff — · — · …" would be broken and confusing.
  if (PROFILE_SLOTS.every((s) => !p.answered[s])) return ''
  const loc = titleCasePlace(p.district) ?? 'Anywhere in TN'
  const branch = p.branch ?? 'any branch'
  return `Based on your profile — Cutoff ${p.cutoff !== null ? p.cutoff : '—'} · ${p.community ?? '—'} · ${loc} · ${branch}:`
}

/** Title-case a stored (lowercased) district for display: "coimbatore" → "Coimbatore". */
function titleCasePlace(place: string | null): string | null {
  if (!place) return null
  return place.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Levenshtein edit distance (small strings only). */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const prev = Array.from({ length: n + 1 }, (_, j) => j)
  const cur = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1])
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]
  }
  return prev[n]
}

/**
 * Resolve a typed district to the nearest KNOWN district (lowercased), tolerating
 * misspellings ("coimbaore" → "coimbatore"). Returns null when nothing is close enough
 * — the caller then broadens the search statewide rather than filtering to nothing.
 */
export function resolveDistrict(input: string, known: ReadonlySet<string>): string | null {
  const q = input.trim().toLowerCase()
  if (!q) return null
  if (known.has(q)) return q
  let best: string | null = null
  let bestDist = Infinity
  for (const d of known) {
    const dist = editDistance(q, d)
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  // Allow ~1 typo per 5 characters (min 1), so short names don't over-match.
  const tolerance = Math.max(1, Math.floor(q.length / 5))
  return best && bestDist <= tolerance ? best : null
}
