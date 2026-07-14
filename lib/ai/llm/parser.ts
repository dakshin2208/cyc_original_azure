/**
 * @module lib/ai/llm/parser
 *
 * Parses a raw LLM completion (possibly wrapped in prose or ```json fences) into
 * the Sprint 4 {@link AIResponse} DTO. Deterministic and defensive: it extracts
 * the first JSON object, narrows every field with type guards, coerces enum-ish
 * fields to their valid domains, and fails cleanly (never throws) when `answer`
 * is absent. No AI.
 */

import {
  ENTITY_TYPES,
  EVIDENCE_SOURCES,
  type AIResponse,
  type ConfidenceLevel,
  type EvidenceSource,
  type FollowUpQuestion,
  type ResponseCitation,
} from '@/lib/ai/orchestration'

/** The result of parsing a raw completion. */
export type ParseResult =
  | { readonly ok: true; readonly value: AIResponse }
  | { readonly ok: false; readonly error: string }

const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ['high', 'medium', 'low']
const EXPECTS_VALUES: readonly string[] = [
  ...ENTITY_TYPES,
  'cutoff_dataset',
  'fees_dataset',
  'branch_linkage',
]

type Json = Record<string, unknown>

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Extract the first balanced JSON object from arbitrary text. */
export function extractJsonObject(raw: string): string | null {
  if (typeof raw !== 'string') return null
  // Prefer a fenced ```json … ``` block when present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fence ? fence[1] : raw
  const start = source.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

function coerceConfidence(v: unknown): ConfidenceLevel {
  const s = asString(v)
  return s && (CONFIDENCE_LEVELS as readonly string[]).includes(s) ? (s as ConfidenceLevel) : 'low'
}

function coerceSource(v: unknown): EvidenceSource {
  const s = asString(v)
  return s && (EVIDENCE_SOURCES as readonly string[]).includes(s) ? (s as EvidenceSource) : 'retrieval'
}

function coerceCitations(v: unknown): ResponseCitation[] {
  if (!Array.isArray(v)) return []
  const out: ResponseCitation[] = []
  for (const item of v) {
    if (!isRecord(item)) continue
    const evidenceId = asString(item.evidenceId)
    if (!evidenceId) continue
    out.push({
      evidenceId,
      collegeName: asString(item.collegeName),
      label: asString(item.label) ?? '',
      source: coerceSource(item.source),
    })
  }
  return out
}

function coerceFollowUps(v: unknown): FollowUpQuestion[] {
  if (!Array.isArray(v)) return []
  const out: FollowUpQuestion[] = []
  for (const item of v) {
    if (!isRecord(item)) continue
    const question = asString(item.question)
    if (!question) continue
    const expectsRaw = asString(item.expects)
    const expects = (expectsRaw && EXPECTS_VALUES.includes(expectsRaw) ? expectsRaw : 'college') as FollowUpQuestion['expects']
    out.push({ question, expects, reason: asString(item.reason) ?? '' })
  }
  return out
}

// ── Evidence-id scrubbing (presentation only — citations are untouched) ──────
//
// The prompt hands the model its evidence as `[retrieval-psg-…-total-faculty-283]`, so it
// echoes those keys straight into the prose: "283 faculty members, with 140 holding PhDs
// ([retrieval-psg-…-total-faculty-283], [retrieval-psg-…-nirf-ranked-yes])". A parent sees
// internal database keys in the first ten seconds. The prompt now forbids it (belt), and this
// strips whatever still slips through (suspenders) — models are not reliable about formatting.
//
// This runs at PARSE time, before validation and the hallucination guard, deliberately: the ids
// carry digits ("…-phd-140", "…-rate-69-6") and the guard scans sentences for numeric claims, so
// the tokens pollute its input as well as the user's screen. `citations` are NEVER touched —
// grounding, validation and the UI keep the full evidence trail.

/** A bracketed evidence key: lowercase, hyphenated, 3+ segments — never ordinary prose. */
const BRACKETED_ID = /\[\s*[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}\s*\]/g
/** The same key written without brackets, which some models do. */
const BARE_ID = /(?<![\w-])(?:retrieval|comparison|recommendation|evidence|fact)-[a-z0-9]+(?:-[a-z0-9]+)+/g

/**
 * Remove evidence ids from user-facing prose, leaving clean English — no orphaned "( )",
 * no " ." and no double spaces. Exported for direct testing.
 */
export function stripEvidenceIds(text: string): string {
  return text
    .replace(BRACKETED_ID, '')
    .replace(BARE_ID, '')
    .replace(/\(\s*(?:[,;]\s*)*\)/g, '') // "(, )" left behind by the removal
    .replace(/\[\s*(?:[,;]\s*)*\]/g, '')
    .replace(/[ \t]*([,.;:!?])/g, '$1') // " ." → "."
    .replace(/([,;])\s*([.;:!?])/g, '$2') // ", ." → "."
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

/** Parse a raw completion string into an {@link AIResponse}. */
export function parseAIResponse(raw: string): ParseResult {
  const jsonText = extractJsonObject(raw)
  if (jsonText === null) return { ok: false, error: 'no JSON object found in completion' }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${(e as Error).message}` }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'top-level value is not an object' }

  const answer = asString(parsed.answer)
  if (answer === null || answer.trim().length === 0) {
    return { ok: false, error: 'missing or empty "answer"' }
  }
  // Scrub internal evidence keys from the prose. If the model wrote NOTHING but ids, the
  // answer is now empty and the response is rejected — the deterministic fallback then serves,
  // which is the correct outcome (an "answer" made only of database keys is not an answer).
  const prose = stripEvidenceIds(answer)
  if (prose.length === 0) return { ok: false, error: 'answer contained no prose (evidence ids only)' }

  const value: AIResponse = {
    answer: prose,
    citations: coerceCitations(parsed.citations),
    followUps: coerceFollowUps(parsed.followUps),
    confidence: coerceConfidence(parsed.confidence),
    hadMissingInformation: parsed.hadMissingInformation === true,
  }
  return { ok: true, value }
}
