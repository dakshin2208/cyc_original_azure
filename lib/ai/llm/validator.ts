/**
 * @module lib/ai/llm/validator
 *
 * Response validation + the Hallucination Guard. Two complementary, deterministic
 * mechanisms grounded ONLY in the Sprint 4 {@link ContextPackage}:
 *
 *  • validateResponse — HARD structural checks. Rejects (→ the adapter falls back)
 *    when the answer/confidence is missing or a CITATION references evidence or a
 *    college that was never supplied (i.e. an invented citation).
 *
 *  • applyHallucinationGuard — SOFT prose repair. Every factual sentence must be
 *    backed by the supplied evidence; a sentence asserting a cutoff/placement/fee
 *    figure absent from the evidence, or naming a college that isn't in the
 *    context, is REMOVED. If nothing supported remains, the answer is REPLACED
 *    with "I don't have sufficient evidence."
 *
 * No AI, no network — pure string + set operations over supplied facts.
 */

import type { AIResponse, ContextPackage } from '@/lib/ai/orchestration'
import type { ResponseIssue } from './response'

/** The allow-lists derived from the deterministic context. */
export interface Grounding {
  /** Every evidence id the prompt offered for citation. */
  readonly evidenceIds: ReadonlySet<string>
  /** Every college name the context is about (lower-cased). */
  readonly knownColleges: ReadonlySet<string>
  /** Every numeric figure the evidence supports (raw + lakh/crore/rounded forms). */
  readonly allowedNumbers: ReadonlySet<string>
  readonly hasEvidence: boolean
}

const CONFIDENCE_LEVELS: readonly string[] = ['high', 'medium', 'low']
const DOMAIN_KEYWORDS = [
  'cutoff', 'closing', 'cut-off', 'salary', 'package', 'ctc', 'lpa', 'fee', 'fees',
  'tuition', 'placement', 'placements', 'placed', 'median', 'stipend', 'rank', 'ranked',
]
const DETERMINERS = new Set([
  'this', 'that', 'the', 'these', 'those', 'our', 'your', 'its', 'their', 'a', 'an',
  'each', 'any', 'no', 'some', 'both', 'either', 'neither', 'another', 'such', 'one',
  'best', 'top', 'good', 'every', 'many', 'few',
])
const COLLEGE_PHRASE = /\b([A-Z][A-Za-z.&'-]*(?:\s+[A-Za-z.&'-]+){0,6}?\s+(?:College|University|Institute|Polytechnic))\b/g
// Comma-grouped form (Western ,ddd or Indian ,dd) requires ≥1 comma so a plain
// "900000" is matched whole by the second alternative, not split into "900".
const NUMBER_TOKEN = /(₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(%|percent|lpa|lakhs?|crores?|k)?/gi

const trimNum = (n: number): string => String(Number(n.toFixed(2)))

function addNumberVariants(set: Set<string>, value: number): void {
  if (!Number.isFinite(value)) return
  set.add(String(value))
  set.add(String(Math.round(value)))
  if (!Number.isInteger(value)) set.add(value.toFixed(1))
  if (value >= 100000) {
    set.add(trimNum(value / 100000)) // lakh
    set.add((value / 100000).toFixed(1))
    set.add(trimNum(value / 10000000)) // crore
  }
}

/** Build the grounding allow-lists from the deterministic context. */
export function buildGrounding(context: ContextPackage): Grounding {
  const knownColleges = new Set<string>()
  const addCollege = (name: string | null | undefined): void => {
    if (name) knownColleges.add(name.toLowerCase())
  }
  for (const s of context.subjects) addCollege(s.name)
  for (const r of context.recommendations) addCollege(r.college.name)
  if (context.comparison) for (const c of context.comparison.colleges) addCollege(c.name)
  for (const f of context.facts) addCollege(f.collegeName)
  for (const e of context.evidence.items) addCollege(e.collegeName)

  const allowedNumbers = new Set<string>()
  for (const e of context.evidence.items) if (typeof e.value === 'number') addNumberVariants(allowedNumbers, e.value)
  for (const f of context.facts) if (typeof f.value === 'number') addNumberVariants(allowedNumbers, f.value)

  return {
    evidenceIds: new Set(context.evidence.items.map((i) => i.id)),
    knownColleges,
    allowedNumbers,
    hasEvidence: context.evidence.count > 0,
  }
}

// ── Structural validation (hard reject) ──────────────────────────────────────

/** The outcome of structural validation. */
export interface ValidationOutcome {
  readonly ok: boolean
  readonly issues: readonly ResponseIssue[]
}

/** Structurally validate a parsed response against the grounding. */
export function validateResponse(response: AIResponse, grounding: Grounding): ValidationOutcome {
  const issues: ResponseIssue[] = []
  const err = (code: string, message: string): void => void issues.push({ code, message, severity: 'error' })

  if (typeof response.answer !== 'string' || response.answer.trim().length === 0) {
    err('missing_answer', 'response has no answer')
  }
  if (!CONFIDENCE_LEVELS.includes(response.confidence)) {
    err('missing_confidence', `invalid confidence "${response.confidence}"`)
  }
  for (const c of response.citations) {
    if (!grounding.evidenceIds.has(c.evidenceId)) {
      err('unknown_citation', `citation references unknown evidence id "${c.evidenceId}"`)
    }
    if (c.collegeName && !grounding.knownColleges.has(c.collegeName.toLowerCase())) {
      err('unknown_cited_college', `citation references unknown college "${c.collegeName}"`)
    }
  }
  return { ok: issues.length === 0, issues }
}

// ── Hallucination guard (soft repair) ────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function isKnownCollege(phrase: string, known: ReadonlySet<string>): boolean {
  if (known.has(phrase)) return true
  for (const k of known) if (k.includes(phrase) || phrase.includes(k)) return true
  return false
}

/** Colleges named in a sentence that are NOT in the grounding. */
function hallucinatedColleges(sentence: string, known: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const match of sentence.matchAll(COLLEGE_PHRASE)) {
    let words = match[1].trim().replace(/\s+/g, ' ').split(' ')
    while (words.length > 1 && DETERMINERS.has(words[0].toLowerCase())) words = words.slice(1)
    if (words.length < 2) continue // bare "College"/"University" → generic, ignore
    const phrase = words.join(' ').toLowerCase()
    if (!isKnownCollege(phrase, known)) out.push(words.join(' '))
  }
  return out
}

/** Does a sentence assert a cutoff/placement/fee figure the evidence doesn't support? */
function hasFabricatedFigure(sentence: string, allowed: ReadonlySet<string>): boolean {
  const lower = sentence.toLowerCase()
  if (!DOMAIN_KEYWORDS.some((k) => lower.includes(k))) return false
  for (const m of sentence.matchAll(NUMBER_TOKEN)) {
    const hasCurrencyOrPct = Boolean(m[1]) || Boolean(m[3])
    const digits = m[2].replace(/,/g, '')
    const value = Number(digits)
    if (!Number.isFinite(value)) continue
    const intDigits = digits.split('.')[0].length
    const significant = intDigits >= 3 || digits.includes('.') || hasCurrencyOrPct
    if (!significant) continue
    // A bare 4-digit year (not a currency/percent figure) is not a claimed figure.
    if (!hasCurrencyOrPct && Number.isInteger(value) && value >= 1990 && value <= 2099) continue
    const candidates = [String(value), String(Math.round(value)), trimNum(value)]
    if (!candidates.some((c) => allowed.has(c))) return true
  }
  return false
}

/** The result of guarding a response. */
export interface GuardOutcome {
  readonly response: AIResponse
  readonly issues: readonly ResponseIssue[]
  /** The sentences that were removed as unsupported. */
  readonly removed: readonly string[]
}

/**
 * The issue code emitted ONCE PER SENTENCE the guard strips. Counting these is how the
 * hallucination guard becomes observable: `status: 'repaired'` says the guard fired, this
 * says how hard. The issue's MESSAGE is the removed sentence itself (model prose that can
 * paraphrase the student's own details), so only ever count these — never log the message.
 */
export const REMOVED_SENTENCE_CODE = 'removed_unsupported_sentence'

/**
 * Remove unsupported factual sentences; replace the whole answer with the given
 * insufficient-evidence text if nothing supported remains.
 */
export function applyHallucinationGuard(
  response: AIResponse,
  grounding: Grounding,
  insufficientEvidenceText: string,
): GuardOutcome {
  const issues: ResponseIssue[] = []
  const removed: string[] = []
  const kept: string[] = []

  for (const sentence of splitSentences(response.answer)) {
    const colleges = hallucinatedColleges(sentence, grounding.knownColleges)
    const fabricated = hasFabricatedFigure(sentence, grounding.allowedNumbers)
    if (colleges.length > 0) {
      issues.push({ code: 'hallucinated_college', message: `unsupported college(s): ${colleges.join(', ')}`, severity: 'error' })
    }
    if (fabricated) {
      issues.push({ code: 'fabricated_figure', message: `sentence asserts an unsupported figure: "${sentence}"`, severity: 'error' })
    }
    if (colleges.length > 0 || fabricated) {
      removed.push(sentence)
      issues.push({ code: REMOVED_SENTENCE_CODE, message: sentence, severity: 'warning' })
    } else {
      kept.push(sentence)
    }
  }

  if (removed.length === 0) return { response, issues, removed }

  const answer = kept.length > 0 ? kept.join(' ') : insufficientEvidenceText
  if (kept.length === 0) {
    issues.push({ code: 'no_supported_content', message: 'no supported sentences remained', severity: 'warning' })
  }
  return { response: { ...response, answer }, issues, removed }
}
