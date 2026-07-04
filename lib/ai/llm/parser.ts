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

  const value: AIResponse = {
    answer: answer.trim(),
    citations: coerceCitations(parsed.citations),
    followUps: coerceFollowUps(parsed.followUps),
    confidence: coerceConfidence(parsed.confidence),
    hadMissingInformation: parsed.hadMissingInformation === true,
  }
  return { ok: true, value }
}
