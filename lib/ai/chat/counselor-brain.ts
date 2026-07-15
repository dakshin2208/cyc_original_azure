/**
 * @module lib/ai/chat/counselor-brain
 *
 * The Orchestration Brain for the counselor conversation. It COORDINATES — it does
 * not execute. Given the current conversation context (the message, the parsed query,
 * the prior and merged student profile, and whether the profile was already complete /
 * the message is a question), it selects the single capability/route for this turn and
 * returns a {@link CounselorDecision}. It performs NO dataset retrieval, NO business
 * reasoning, NO recommendation generation, NO LLM narration, NO prompt building, and NO
 * persistence — the {@link CounselorChatService} executes the returned decision.
 *
 * This logic was extracted verbatim from the counselor service's `handle()` cascade;
 * the routing decisions are unchanged.
 */

import type { ParsedQuery } from '@/lib/ai/orchestration'
import {
  isComplete,
  nextMissingRequiredSlot,
  nextMissingSlot,
  PROFILE_SLOTS,
  type ProfileSlot,
  type StudentProfile,
} from './profile'

// ── Decision-only matchers (moved out of the service; identical patterns) ─────
const GOVT_RE = /\bgovern(?:ment|ance)?\b|\bgovt\b|\baided\b/i
const PRIVATE_RE = /\bprivate\b|\bself[ -]?financ\w*\b|\bdeemed\b/i
const SAFER_RE = /\bsafe(?:r|st)?\b|\bbackup(?:s)?\b|\bsure[ -]?shot\b|\bguaranteed\b|\bwithin reach\b|\blow[ -]?risk\b/i
const REMOVE_RE =
  /\b(remove|exclude|drop|without|don'?t (?:want|like|show)|not interested in|take out|leave out|skip|get rid of)\b/i
const COMPARE_RE = /\b(compare|comparison|versus|difference between|better between)\b|\bvs\.?\b/i
// A pure social / acknowledgement message — the ONLY complete-profile input that should
// NOT produce a recommendation. Everything else is treated as a counselling question.
const SOCIAL_RE = /^(ok(ay)?|k|thanks?|thank you|thx|cool|nice|great|good|got ?it|fine|hmm+|hi+|hello|hey|yo|bye|done|sure|yes|yeah|yep|no|nope|👍|🙏)[\s!.]*$/i
// Eligibility ("will he get a seat?", "chances?", "can she get admission?") — matches
// first- AND third-person, since a parent asks on the student's behalf.
const ELIGIBILITY_RE =
  /\b(will|can|could|would|does|do)\s+(i|he|she|they|we|my (son|daughter|child|kid|ward))\s+(get|join|make it|get in|get into|qualify)\b|\b(get|getting)\s+(a\s+)?(seat|admission)\b|\bchances?\b|\bdefinitely get\b|\beligib\w*\b|\bqualify\b|\bsafe seat\b/i
const FEE_RE = /\b(cheap(?:er|est)?|afford\w*|budget|low(?:er)?[ -]?fees?|fees?|tuition|scholarships?|cost\w*)\b/i
const HOSTEL_RE = /\b(hostels?|accommodations?|mess(?:es)?|campus life|dining|food|canteens?)\b/i
// Recruiter NAMES aren't in the dataset (placement RATE and median salary ARE) — so
// "which companies recruit" is honestly declined, while "placements"/"salary" is answered.
const RECRUITER_RE = /\brecruit\w*\b|\b(which|what|name|list|top)\b[^.?]{0,24}\bcompan\w*|\bfirms?\b|\bplacement partners?\b/i
// Tier view: "dream / target / safe colleges", "reach and safe options".
const TIER_WORD_RE = /\b(dream|target|safe|reach|aspirational|ambitious|realistic)\b/i
const TIER_NOUN_RE = /colleg|collage|\boption|\bchoice|\btier|\blist\b|\bget\b/i
// Preference-list intent: "build my preference list", "fill my choices", "arrange my
// college list", "which order should I choose", "generate my TNEA preference list".
// Conservative: needs an explicit list/choice/preference/order cue (never a bare
// "options"/"list the best colleges"), so ordinary recommendation asks are untouched.
const PREFLIST_RE =
  /\bpreference list\b|\bpref list\b|\b(build|make|create|generate|prepare|fill|arrange|organi[sz]e|sort)\b[^.?]{0,20}\b(list|choices?|preferences?)\b|\bfill (?:in |up )?my (?:choices?|options?|preferences?|list)\b|\b(which|what) order\b|\border (?:should i|my (?:choices?|colleges?|list|preferences?))\b|\bchoice (?:order|filling)\b|\btnea (?:preference|choice)\b/i
// A pure opening/greeting on a fresh session → show the welcome, never front-load profile
// questions. Anchored so "hi, compare PSG and CIT" is a comparison, not a greeting.
const GREETING_RE =
  /^(hi+|hey+|hello+|hii+|yo|hola|namaste|vanakkam|hai|start|begin|get started|let'?s start|help|menu|good (morning|afternoon|evening))[\s!.]*$/i
// A DIRECTORY listing ask: an explicit "list/show/name/top-N … colleges" cue, or "colleges in
// <place>". Paired with a resolved location in the router; the personalised "which colleges can
// I get" is a recommendation and is intentionally NOT matched here.
const LISTING_RE =
  /\b(list|show|give|name|display)\b[^?]*\bcolle\w+|\btop\s+\d+\b[^?]*\bcolle\w+|\bcolle\w+\s+(in|at|near|around|within)\b|\bhow many colle\w+/i
/** The count requested by a listing ask ("top 10 …", "10 colleges …"); default 10, capped 25. */
function listingCount(message: string): number {
  const m = /\btop\s+(\d{1,3})\b/i.exec(message) ?? /\b(\d{1,3})\s+colle\w+/i.exec(message)
  const n = m ? Number(m[1]) : 10
  return Math.max(1, Math.min(25, Number.isFinite(n) ? n : 10))
}

/**
 * A DIRECTORY listing ask — an explicit list cue AND a resolved location, with no named college
 * and no comparison. Exported so the coordinator can skip the profile MERGE for it (a directory
 * query must not silently set the student's district preference).
 */
export function isListingAsk(message: string, parsed: ParsedQuery): boolean {
  return !COMPARE_RE.test(message) && parsed.colleges.length === 0 && Boolean(parsed.location) && LISTING_RE.test(message)
}

// Intent-first profile gate: only these capabilities need a student profile. Knowledge,
// comparison, college-info, and branch guidance are answered WITHOUT any profile.
const PROFILE_KINDS = new Set<CounselorDecision['kind']>(['recommend', 'preferenceList', 'tier', 'refine', 'profileChanged', 'exclude'])
// Recommendation / eligibility intents that need a profile even when routed as a bare
// question — but ONLY when the query is a personalized college-fit ask ("for me", "can I
// get", "recommend"). This keeps branch guidance ("which branch has the best future?" —
// classified recommend_college because of "best") answered WITHOUT a profile.
const PROFILE_INTENTS = new Set<string>(['recommend_college', 'eligibility_query', 'cutoff_query'])
const COLLEGE_FIT_RE =
  /\bcolleges?\b|\bfor me\b|\bcan i (get|join)\b|\bwhich college\b|\bmy (cutoff|rank|marks?|community|score)\b|\brecommend\b|\bsuggest\b|\bget (a |an |into )?(seat|admission)\b|\bwhere should i\b/i

/** Whether a PROFILE SLOT (not just a college mention) changed — drives re-counsel. */
function slotChanged(prior: StudentProfile, profile: StudentProfile): boolean {
  return PROFILE_SLOTS.some((s) => prior[s] !== profile[s] || prior.answered[s] !== profile.answered[s])
}

/** Whether the chosen capability requires a student profile before it can answer. */
function routeNeedsProfile(route: CounselorDecision, parsed: ParsedQuery, message: string): boolean {
  if (PROFILE_KINDS.has(route.kind)) return true
  if (route.kind === 'answerQuestion') {
    return parsed.colleges.length === 0 && PROFILE_INTENTS.has(parsed.intent) && COLLEGE_FIT_RE.test(message)
  }
  return false
}

/**
 * A complete-profile message that RE-SCOPES the search to a college TYPE or a SAFETY
 * view — returns a clean engine trigger + a natural intro. Returns null when the message
 * names a specific college (so comparisons and college-specific questions are never
 * hijacked) or isn't a scope refinement. Moved verbatim from the counselor service.
 */
export function refinementTrigger(message: string, parsed: ParsedQuery): { trigger: string; intro: string } | null {
  if (parsed.colleges.length > 0) return null // a named college → a question, not a re-scope
  if (GOVT_RE.test(message)) {
    return { trigger: 'recommend the best government colleges for me', intro: 'Sure — here are the government options for your rank and district:' }
  }
  if (PRIVATE_RE.test(message)) {
    return { trigger: 'recommend the best private colleges for me', intro: 'Here are the private options that fit your profile:' }
  }
  if (SAFER_RE.test(message)) {
    return { trigger: 'which colleges can I safely get into', intro: "Let's look at how realistic each seat is for your rank — safest bets first:" }
  }
  if (ELIGIBILITY_RE.test(message)) {
    return { trigger: 'which colleges can I safely get into', intro: "Here's how realistic each option is for that rank — the safe bets first, then the stretches:" }
  }
  if (/\b(placement|placements|job|jobs|package|salary|highest paying)\b/i.test(message)) {
    return { trigger: 'which colleges have the best placements', intro: 'Since placements matter most to you, here they are ranked by placement strength:' }
  }
  if (/\b(roi|return on invest|value for money|worth it)\b/i.test(message)) {
    // Trigger phrasing kept free of tokens the entity extractor mis-reads as an
    // unverifiable college ("investment" tripped `unverifiedCollege`); "best roi
    // colleges" parses cleanly and still routes to the ROI strategy.
    return { trigger: 'best roi colleges', intro: 'Ranking these by return on investment:' }
  }
  if (/\b(research|innovation|higher studies|for ms|do ms|phd)\b/i.test(message)) {
    return { trigger: 'colleges with the best research', intro: 'Ranking by research strength:' }
  }
  if (/\b(reputation|brand|prestige|well[ -]?known|nirf|overall ranking)\b/i.test(message)) {
    return { trigger: 'the best overall colleges', intro: 'Ranking by overall reputation:' }
  }
  return null
}

/** The single route the brain selects for a turn. The service executes it. */
export type CounselorDecision =
  /** Fresh-session greeting — show the welcome, do NOT ask for profile (intent-first). */
  | { readonly kind: 'welcome' }
  /** Collect the given profile slot — only for a capability that requires a profile.
   *  `forKind` is the capability that triggered collection (drives the first-slot intro). */
  | { readonly kind: 'collectSlot'; readonly slot: ProfileSlot; readonly firstContact: boolean; readonly forKind?: CounselorDecision['kind'] }
  /** Onboarding just completed — confirm the collected profile and invite a question. */
  | { readonly kind: 'onboardingSummary' }
  /** "remove / drop <college>" — record the exclusion and re-counsel. */
  | { readonly kind: 'exclude'; readonly colleges: readonly string[] }
  /** An explicit profile change — re-counsel with the updated profile. */
  | { readonly kind: 'profileChanged' }
  /** Build a submission-ready TNEA preference list from the eligibility bands. */
  | { readonly kind: 'preferenceList' }
  /** Tier view — safe / target / dream bands. */
  | { readonly kind: 'tier' }
  /** Comparison intent but fewer than two colleges identified — ask for the second. */
  | { readonly kind: 'compareNeedsTwo'; readonly found: string | null }
  /** A scope refinement (govt/private/safer/priority) — re-counsel with a clean trigger. */
  | { readonly kind: 'refine'; readonly trigger: string; readonly intro: string }
  /** Fees / hostel / recruiter names — honestly absent from the dataset. */
  | { readonly kind: 'dataDecline'; readonly topic: 'fee' | 'hostel' | 'recruiter'; readonly college: string | null }
  /** A directory listing — N colleges in a city/branch. Needs NO profile. */
  | { readonly kind: 'listColleges'; readonly city: string; readonly count: number; readonly branch: string | null }
  /** A keyworded follow-up question — answer it using the stored profile. */
  | { readonly kind: 'answerQuestion' }
  /** A pure social / acknowledgement message — a light nudge. */
  | { readonly kind: 'social' }
  /** Anything else from a complete profile — a counselling request. */
  | { readonly kind: 'recommend' }

/** The context the brain reasons over. All values are computed by the coordinator. */
export interface BrainContext {
  readonly message: string
  readonly parsed: ParsedQuery
  readonly priorProfile: StudentProfile
  readonly profile: StudentProfile
  /** Whether the profile was already complete BEFORE this message. */
  readonly wasComplete: boolean
  /** Whether this message asks something (vs. a bare slot value / update). */
  readonly hasQuestion: boolean
}

/**
 * Route to the capability the user actually wants — WITHOUT any profile gate. Pure: no
 * side effects, no I/O. The cascade order and every predicate are unchanged from before;
 * only the two upfront profile-collection checks were lifted out (into {@link decideTurn}).
 */
function baseRoute(ctx: BrainContext): CounselorDecision {
  const { message, parsed, priorProfile, profile, hasQuestion } = ctx

  // Exclusion: "remove / drop <college>" — remember it and re-counsel without it.
  if (REMOVE_RE.test(message) && parsed.colleges.length > 0) {
    return { kind: 'exclude', colleges: parsed.colleges }
  }

  // Directory listing — "top 10 colleges in coimbatore", "list colleges in chennai". Needs NO
  // profile (a directory is public), so it is routed FIRST (before the profile-slot check) and
  // excluded from the profile gate: "in coimbatore" would otherwise be read as a district-slot
  // update and hijack the turn into onboarding. `isListingAsk` gates it — an explicit list cue
  // plus a resolved location — so "which colleges can I get" (a personalised recommendation) is
  // never caught here.
  if (isListingAsk(message, parsed)) {
    return { kind: 'listColleges', city: parsed.location as string, count: listingCount(message), branch: parsed.branch }
  }

  // A profile SLOT change → re-counsel (also drives slot-by-slot collection: each answered
  // slot changes the profile). A bare college MENTION is NOT a slot change, so knowledge /
  // comparison questions are not mis-read as a profile update.
  if (slotChanged(priorProfile, profile)) return { kind: 'profileChanged' }

  // Preference-list intent — build a submission-ready ordered list from the bands.
  if (!COMPARE_RE.test(message) && !parsed.hasMultipleColleges && PREFLIST_RE.test(message)) {
    return { kind: 'preferenceList' }
  }

  // Tier view — routed BEFORE college-based routing so tier words can't be mis-matched.
  if (
    !COMPARE_RE.test(message) &&
    !parsed.hasMultipleColleges &&
    TIER_WORD_RE.test(message) &&
    TIER_NOUN_RE.test(message)
  ) {
    return { kind: 'tier' }
  }

  // Comparison intent but fewer than two colleges identified — ask for the second name.
  if (COMPARE_RE.test(message) && parsed.colleges.length < 2) {
    return { kind: 'compareNeedsTwo', found: parsed.colleges[0] ?? null }
  }

  // A scope refinement on the SAME student — re-counsel without restarting.
  const refine = refinementTrigger(message, parsed)
  if (refine) return { kind: 'refine', trigger: refine.trigger, intro: refine.intro }

  // Fees / hostel / recruiter names — honestly absent from the official dataset.
  if (!parsed.hasMultipleColleges) {
    const college = parsed.colleges[0] ?? null
    if (FEE_RE.test(message)) return { kind: 'dataDecline', topic: 'fee', college }
    if (HOSTEL_RE.test(message)) return { kind: 'dataDecline', topic: 'hostel', college }
    if (RECRUITER_RE.test(message)) return { kind: 'dataDecline', topic: 'recruiter', college }
  }

  // A keyworded question → knowledge / comparison / branch guidance / recommendation.
  if (hasQuestion) return { kind: 'answerQuestion' }

  // A pure social / acknowledgement message → a light nudge, no recommendation.
  if (SOCIAL_RE.test(message.trim())) return { kind: 'social' }

  // A NAMED college without an explicit question marker ("tell me about PSG") is still a
  // question ABOUT that college — never a global recommendation (which would wrongly
  // demand a profile before answering).
  if (parsed.colleges.length > 0) return { kind: 'answerQuestion' }

  // Anything else → a counselling (recommendation) request.
  return { kind: 'recommend' }
}

/**
 * Select the single route for this turn — INTENT-FIRST. Pure: no side effects, no I/O.
 *
 * 1. A fresh-session greeting → welcome (never front-load profile questions).
 * 2. Otherwise route to the capability the user wants ({@link baseRoute}).
 * 3. Collect a profile slot ONLY when that capability requires one and a field is missing
 *    — knowledge, comparison, college-info and branch guidance answer with no profile.
 */
export function decideTurn(ctx: BrainContext): CounselorDecision {
  const { message, priorProfile, profile, parsed } = ctx

  // Intent-first: greet on a fresh session; a substantive first question is answered below.
  if (!isComplete(profile) && GREETING_RE.test(message.trim())) return { kind: 'welcome' }

  const route = baseRoute(ctx)

  if (routeNeedsProfile(route, parsed, message)) {
    const firstContact = PROFILE_SLOTS.every((s) => !priorProfile.answered[s])

    // BLOCK only on a REQUIRED slot (cutoff / community) — they gate eligibility, so no
    // realistic answer exists without them.
    const required = nextMissingRequiredSlot(profile)
    if (required) return { kind: 'collectSlot', slot: required, firstContact, forKind: route.kind }

    // The refinements (district, branch) are gathered progressively while the user is still
    // FILLING the profile — i.e. this very message set a slot. A genuine question is NEVER
    // blocked on them: with cutoff + community in hand the engine ranks across all branches
    // ("any branch"), so a parent asking for colleges gets colleges, not a fourth prompt.
    if (route.kind === 'profileChanged') {
      const refinement = nextMissingSlot(profile)
      if (refinement) return { kind: 'collectSlot', slot: refinement, firstContact, forKind: route.kind }
    }
  }
  return route
}
