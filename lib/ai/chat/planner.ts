/**
 * @module lib/ai/chat/planner
 *
 * The LLM PLANNER — it owns UNDERSTANDING. Given {message, profile, memory} it decides WHAT is
 * being asked and returns a small STRUCTURED PLAN. It does NOT fetch data, does NOT rank, does
 * NOT invent a fact.
 *
 * The safety contract, and the reason this is not "let the LLM answer":
 *   • The planner emits the USER'S WORDS ("psg", "CIT") and an ACTION from a CLOSED enum.
 *   • It NEVER emits a college id, a Power Score, a cutoff, a salary, or any number that is a
 *     fact. Those come from the deterministic engine and the stored profile — never from here.
 *   • Every field it emits is re-resolved by the EXISTING deterministic resolvers downstream
 *     (the query parser's college lexicon, the district set, branch aliases). A name the planner
 *     invents that resolves to nothing is dropped by the same word-alignment guard that stops
 *     "my son" becoming "Sona College" — the phantom-college protection is untouched.
 *   • A malformed / unreachable / low-value plan returns `null`, and the caller falls back to the
 *     deterministic keyword classifier. The planner can improve a turn; it can never break one.
 */

import type { LLMProvider } from '@/lib/ai/llm'
import type { ConversationMemory } from './conversation-memory'
import type { StudentProfileView } from './profile'

/** The closed set of things a counselling turn can be asking for. */
export const PLANNER_ACTIONS = [
  'list_colleges', // "top 10 colleges in coimbatore" — a directory, needs no profile
  'recommend', // "which colleges can I get / should I pick"
  'compare', // "compare X and Y"
  'eligibility_at_college', // "which course can I get at X with my cutoff"
  'college_overview', // "tell me about X", "is X good"
  'metric_query', // "placements / faculty / cutoff / rank at X"
  'out_of_scope', // TNEA process, deadlines, documents — not in the dataset
  'need_more_info', // genuinely under-specified
] as const
export type PlannerAction = (typeof PLANNER_ACTIONS)[number]

/** The structured plan — WORDS and an action only, never facts. */
export interface CounselorPlan {
  readonly action: PlannerAction
  /** Colleges AS THE USER WROTE THEM ("psg", "CIT"). Resolved to ids downstream — never here. */
  readonly colleges: readonly string[]
  readonly city: string | null
  readonly branch: string | null
  /** A metric word ("placements", "faculty", "cutoff", "rank") for metric_query. */
  readonly metric: string | null
  /** Requested count for list_colleges. */
  readonly limit: number | null
  readonly confidence: 'high' | 'medium' | 'low'
  /** One line, for telemetry only — never shown to the user. */
  readonly reasoning: string
}

/** Common abbreviations the fuzzy matcher cannot resolve (acronym-of-initials). Expanded
 * BEFORE the parser sees them, so the existing resolver then binds them to real colleges.
 * CIT is deliberately absent: it is ambiguous (Coimbatore vs Chennai Institute of Technology),
 * so it is disambiguated by the city the planner also extracts, not hard-coded here. */
export const ABBREVIATION_ALIASES: Readonly<Record<string, string>> = {
  ssn: 'Sri Sivasubramaniya Nadar College of Engineering',
  tce: 'Thiagarajar College of Engineering',
  ceg: 'College of Engineering Guindy Anna University',
  psg: 'PSG College of Technology',
  psgtech: 'PSG College of Technology',
  kct: 'Kumaraguru College of Technology',
  svce: 'Sri Venkateswara College of Engineering',
  git: 'Government College of Technology',
  gct: 'Government College of Technology',
  mit: 'Madras Institute of Technology',
  vit: 'Vellore Institute of Technology',
  ssnce: 'Sri Sivasubramaniya Nadar College of Engineering',
}

/** Expand a college word via {@link ABBREVIATION_ALIASES}; a `city` disambiguates CIT. */
export function expandCollegeWord(word: string, city: string | null): string {
  const key = word.toLowerCase().replace(/[^a-z]/g, '')
  if (key === 'cit') {
    const c = (city ?? '').toLowerCase()
    if (c.includes('chennai')) return 'Chennai Institute of Technology'
    return 'Coimbatore Institute of Technology' // the common referent
  }
  return ABBREVIATION_ALIASES[key] ?? word
}

/** Inputs the planner reasons over. */
export interface PlannerInput {
  readonly message: string
  readonly profile: StudentProfileView | null
  readonly memory: ConversationMemory
}

/** The planner component. `plan()` returns null on any failure — the caller then falls back. */
export interface CounselorPlanner {
  plan(input: PlannerInput): Promise<CounselorPlan | null>
}

const SYSTEM = [
  'You are the PLANNER for a Tamil Nadu Engineering (TNEA) admission counsellor. Your ONLY job is',
  'to understand WHAT the user is asking and return a small JSON plan. You do NOT answer, you do',
  'NOT recommend, you do NOT state any fact.',
  '',
  'Return ONLY this JSON object:',
  '{"action": <one of: list_colleges|recommend|compare|eligibility_at_college|college_overview|metric_query|out_of_scope|need_more_info>,',
  ' "colleges": string[],  // colleges the USER named, in THEIR words ("psg", "CIT") — do not expand, do not invent',
  ' "city": string|null, "branch": string|null, "metric": string|null, "limit": number|null,',
  ' "confidence": "high"|"medium"|"low", "reasoning": "<one short line>"}',
  '',
  'RULES:',
  '- NEVER put a college id, a rank, a Power Score, a cutoff mark, a salary, or ANY number-as-fact',
  '  in the plan. Cutoff and community are already known from the profile — never ask for them,',
  '  never echo them.',
  '- "colleges" holds ONLY names the user actually wrote. If they named none, return [].',
  '- action=list_colleges for a directory ask ("top 10 colleges in coimbatore"): set city and limit.',
  '- action=eligibility_at_college when they ask what course/seat they can get AT a named college.',
  '- action=metric_query for placements/faculty/cutoff/rank AT a named college: set metric.',
  '- action=out_of_scope for TNEA PROCESS — deadlines, documents, application steps, counselling',
  '  rounds, branch-change rules. We only have college FACTS, not process.',
  '- action=need_more_info only when you truly cannot tell what college-related thing is wanted.',
  '- Prefer high confidence only when the ask is unambiguous.',
].join('\n')

const userBlock = (input: PlannerInput): string => {
  const p = input.profile
  const prof = p
    ? `PROFILE: cutoff ${p.cutoff ?? '—'}, community ${p.community ?? '—'}, district ${p.district ?? '—'}, branch ${p.branch ?? '—'} (complete=${p.complete})`
    : 'PROFILE: none yet'
  const mem = input.memory.lastDiscussedCollege
    ? `LAST DISCUSSED COLLEGE: ${input.memory.lastDiscussedCollege}`
    : 'LAST DISCUSSED COLLEGE: none'
  return `${prof}\n${mem}\n\nMESSAGE: ${input.message}`
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null)
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, 4) : []

/** Parse + VALIDATE a raw completion into a plan. Returns null on anything malformed. */
export function parsePlan(raw: string): CounselorPlan | null {
  const m = /\{[\s\S]*\}/.exec(raw)
  if (!m) return null
  let obj: unknown
  try {
    obj = JSON.parse(m[0])
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const action = o.action
  if (typeof action !== 'string' || !(PLANNER_ACTIONS as readonly string[]).includes(action)) return null
  const conf = o.confidence
  const confidence = conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low'
  const limitRaw = typeof o.limit === 'number' && Number.isFinite(o.limit) ? Math.floor(o.limit) : null
  return {
    action: action as PlannerAction,
    colleges: asStringArray(o.colleges),
    city: asString(o.city),
    branch: asString(o.branch),
    metric: asString(o.metric),
    limit: limitRaw !== null ? Math.max(1, Math.min(50, limitRaw)) : null,
    confidence,
    reasoning: asString(o.reasoning)?.slice(0, 200) ?? '',
  }
}

/**
 * What the service should DO with a plan. A `rewrite` is a CLEAN canonical message that the
 * existing parser resolves correctly (so the engine path is unchanged); `list` and `decline`
 * are handled directly. `null` ⇒ nothing actionable, fall back to the deterministic classifier.
 *
 * NOTE: this does NOT resolve names — it only expands abbreviations and shapes a canonical
 * string. The service then re-parses it with the real lexicon, and if the plan claimed colleges
 * that resolve to NOTHING, the service rejects the plan (the phantom-college guard, reused).
 */
export type PlannedAction =
  | { readonly kind: 'rewrite'; readonly message: string; readonly needsCollege: boolean }
  | { readonly kind: 'list'; readonly city: string; readonly count: number; readonly branch: string | null }
  | { readonly kind: 'decline' }

export function translatePlan(plan: CounselorPlan): PlannedAction | null {
  const cols = plan.colleges.map((c) => expandCollegeWord(c, plan.city))
  switch (plan.action) {
    case 'list_colleges': {
      if (!plan.city) return null // a directory needs a place; without one, let the classifier try
      return { kind: 'list', city: plan.city, count: plan.limit ?? 10, branch: plan.branch }
    }
    case 'eligibility_at_college':
      if (cols.length === 0) return null
      return { kind: 'rewrite', message: `can i get into ${cols[0]}`, needsCollege: true }
    case 'compare':
      if (cols.length < 2) return null
      return { kind: 'rewrite', message: `compare ${cols[0]} and ${cols[1]}`, needsCollege: true }
    case 'college_overview':
      if (cols.length === 0) return null
      return { kind: 'rewrite', message: `tell me about ${cols[0]}`, needsCollege: true }
    case 'metric_query': {
      const metric = (plan.metric ?? 'placements').toLowerCase()
      if (cols.length === 0) return null
      return { kind: 'rewrite', message: `${metric} at ${cols[0]}`, needsCollege: true }
    }
    case 'recommend': {
      const where = plan.city ? ` in ${plan.city}` : ''
      const branch = plan.branch ? ` for ${plan.branch}` : ''
      return { kind: 'rewrite', message: `recommend the best colleges${branch}${where} for me`, needsCollege: false }
    }
    case 'out_of_scope':
      return { kind: 'decline' }
    case 'need_more_info':
    default:
      return null // let the deterministic path ask its normal collect/clarify question
  }
}

/** Create the planner over an injected LLM provider (reuses the same provider as narration). */
export function createCounselorPlanner(
  provider: LLMProvider,
  opts: { timeoutMs?: number } = {},
): CounselorPlanner {
  const timeoutMs = opts.timeoutMs ?? 6000
  const plan = async (input: PlannerInput): Promise<CounselorPlan | null> => {
    try {
      const call = provider.complete({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userBlock(input) },
        ],
        responseFormat: 'json',
        temperature: 0,
        maxTokens: 220,
      })
      let handle: ReturnType<typeof setTimeout> | undefined
      const timer = new Promise<null>((resolve) => {
        handle = setTimeout(() => resolve(null), timeoutMs)
      })
      const res = await Promise.race([call, timer])
      if (handle) clearTimeout(handle)
      if (!res) return null // the planner is slow → don't block the turn; use the classifier
      return parsePlan(res.text)
    } catch {
      return null // unreachable provider / any error → fall back to the deterministic classifier
    }
  }
  return Object.freeze({ plan })
}
