/**
 * @module lib/ai/orchestration/query/entity-extractor
 *
 * EntityExtractor — deterministic identification of colleges, branch, cutoff,
 * community, category, score, NIRF rank, fees, placements, scholarship, and
 * location from a normalized question. Numbers are classified by their keyword
 * context; colleges are resolved via the injected {@link QueryLexicon} (Sprint 2
 * fuzzy matcher). Pure; no AI.
 */

import {
  normalizeBranch,
  normalizeCommunity,
  type CanonicalCollege,
  type CommunityCode,
} from '@/lib/knowledge'
import type { EntityType, ExtractedEntity } from '../models'
import type { QueryLexicon } from './lexicon'
import {
  BRANCH_ALIASES,
  COLLEGE_MATCH_THRESHOLD,
  COLLEGE_SKIP_TOKENS,
  CUTOFF_MAX,
  ENTITY_KEYWORDS,
} from './patterns'

/** The structured result of entity extraction. */
export interface ExtractionOutput {
  readonly entities: readonly ExtractedEntity[]
  readonly colleges: readonly CanonicalCollege[]
  readonly branch: string | null
  readonly community: CommunityCode | null
  readonly studentCutoff: number | null
  readonly location: string | null
}

/** The EntityExtractor component. */
export interface EntityExtractor {
  extract(normalized: string, tokens: readonly string[]): ExtractionOutput
}

const DECIMAL = /^\d+(\.\d+)?$/
const COMPARISON_MARKERS = ['compare', 'comparison', ' vs ', ' versus ', ' v/s ', 'difference between', 'which is better', 'better between']
const COMMUNITY_CONTEXT = ['community', 'category', 'quota', 'reservation', 'caste', 'eligible', 'eligibility', 'cutoff']
const WEAK_COMMUNITY = new Set(['SC', 'ST'])
const RANK_KW = ['nirf', 'rank', 'ranked', 'ranking']
const FEE_KW = ['fee', 'fees', 'tuition', 'lakh', 'lakhs', 'rs', 'rupees']
const PLACE_KW = ['package', 'salary', 'lpa', 'ctc']
const SCORE_KW = ['score', 'scored', 'got']
const CUTOFF_KW = ['cutoff', 'cut-off', 'cut', 'closing', 'marks', 'mark']
const COUNT_KW = ['top', 'best', 'first', 'limit'] // "top 5" is a count, not a cutoff

const CONNECTORS = /\s+vs\s+|\s+versus\s+|\s+v\/s\s+|\s+and\s+|\s*,\s*|\s+or\s+/

const has = (window: readonly string[], kws: readonly string[]): boolean =>
  window.some((t) => kws.includes(t))

/** Classify a numeric token by the keywords around it. */
function classifyNumber(
  value: number,
  isInteger: boolean,
  window: readonly string[],
): { type: EntityType; confidence: number } | null {
  if (has(window, RANK_KW) && isInteger) return { type: 'nirf_rank', confidence: 0.95 }
  if (has(window, FEE_KW)) return { type: 'fees', confidence: 0.9 }
  if (has(window, PLACE_KW)) return { type: 'placements', confidence: 0.9 }
  if (has(window, CUTOFF_KW)) return { type: 'cutoff', confidence: 0.95 }
  if (has(window, SCORE_KW)) return { type: 'score', confidence: 0.9 }
  if (has(window, COUNT_KW)) return null // a limit/count, not a metric
  // Bare number that looks like a TNEA cutoff (decimal, or in the engineering band).
  if (!isInteger && value <= CUTOFF_MAX) return { type: 'cutoff', confidence: 0.6 }
  if (value >= 50 && value <= CUTOFF_MAX) return { type: 'cutoff', confidence: 0.55 }
  return null
}

/** Create the entity extractor over an injected lexicon. */
export function createEntityExtractor(lexicon: QueryLexicon): EntityExtractor {
  const padded = (s: string): string => ` ${s} `

  const isDistinctive = (t: string): boolean =>
    t.length >= 3 && !COLLEGE_SKIP_TOKENS.has(t) && !DECIMAL.test(t)

  const extractColleges = (normalized: string): CanonicalCollege[] => {
    const isComparison = COMPARISON_MARKERS.some((m) => padded(normalized).includes(m))

    /**
     * Resolve a fragment to a college ONLY when it carries a distinctive token.
     * The name is matched from the first distinctive token onward (dropping
     * leading intent words) and, as a fallback, from the distinctive core alone.
     */
    const best = (frag: string): CanonicalCollege | null => {
      const words = frag.split(' ').filter((t) => t.length > 0)
      const firstIdx = words.findIndex(isDistinctive)
      if (firstIdx < 0) return null
      const tail = words.slice(firstIdx).join(' ')
      const core = words.filter(isDistinctive).join(' ')
      const candidates = [
        ...lexicon.resolveColleges(tail, 1),
        ...lexicon.resolveColleges(core, 1),
      ].filter((c) => c.score >= COLLEGE_MATCH_THRESHOLD)
      if (candidates.length === 0) return null
      candidates.sort((a, b) => b.score - a.score)
      return candidates[0].college
    }

    const out: CanonicalCollege[] = []
    const seen = new Set<string>()
    const push = (c: CanonicalCollege | null): void => {
      if (c && !seen.has(c.id)) {
        seen.add(c.id)
        out.push(c)
      }
    }

    if (isComparison) {
      for (const seg of normalized.split(CONNECTORS)) {
        if (out.length >= 4) break
        push(best(seg.trim()))
      }
    } else {
      push(best(normalized))
    }
    return out
  }

  const extract = (normalized: string, tokens: readonly string[]): ExtractionOutput => {
    const entities: ExtractedEntity[] = []
    const numericTypes = new Set<EntityType>()
    const contextPresent = tokens.some((t) => COMMUNITY_CONTEXT.includes(t))

    // ── Numbers (cutoff / score / nirf_rank / fees / placements) ──────────────
    let studentCutoff: number | null = null
    let scoreFallback: number | null = null
    tokens.forEach((tok, i) => {
      if (!DECIMAL.test(tok)) return
      const value = Number(tok)
      const window = tokens.slice(Math.max(0, i - 2), i + 3).filter((_, j) => j !== Math.min(i, 2))
      const cls = classifyNumber(value, Number.isInteger(value), window)
      if (!cls) return
      numericTypes.add(cls.type)
      entities.push({ type: cls.type, value, normalized: tok, raw: tok, confidence: cls.confidence })
      if (cls.type === 'cutoff' && value <= CUTOFF_MAX && studentCutoff === null) studentCutoff = value
      if (cls.type === 'score' && value <= CUTOFF_MAX && scoreFallback === null) scoreFallback = value
    })
    if (studentCutoff === null) studentCutoff = scoreFallback

    // ── Community ─────────────────────────────────────────────────────────────
    let community: CommunityCode | null = null
    for (const tok of tokens) {
      const code = normalizeCommunity(tok)
      if (!code) continue
      if (WEAK_COMMUNITY.has(code) && !contextPresent) continue
      community = code
      entities.push({ type: 'community', value: code, normalized: code, raw: tok, confidence: 0.9 })
      break
    }

    // ── Branch (longest alias first) ──────────────────────────────────────────
    let branch: string | null = null
    const aliasesByLen = [...BRANCH_ALIASES].sort((a, b) => b.length - a.length)
    for (const alias of aliasesByLen) {
      if (padded(normalized).includes(padded(alias.trim()))) {
        const norm = normalizeBranch(alias.trim())
        branch = norm.canonicalName
        entities.push({
          type: 'branch',
          value: branch,
          normalized: branch,
          raw: alias.trim(),
          confidence: norm.matched ? 0.95 : 0.7,
        })
        break
      }
    }

    // ── Location ──────────────────────────────────────────────────────────────
    let location: string | null = null
    for (let i = 0; i < tokens.length && !location; i++) {
      const uni = tokens[i]
      const bi = i + 1 < tokens.length ? `${tokens[i]} ${tokens[i + 1]}` : ''
      const hit = lexicon.locations.has(bi) ? bi : lexicon.locations.has(uni) ? uni : null
      if (hit) {
        location = hit
        entities.push({ type: 'location', value: hit, normalized: hit, raw: hit, confidence: 0.85 })
      }
    }

    // ── Category (government / private / …) ───────────────────────────────────
    for (const kw of ENTITY_KEYWORDS.category ?? []) {
      if (padded(normalized).includes(padded(kw))) {
        entities.push({ type: 'category', value: kw, normalized: kw, raw: kw, confidence: 0.9 })
        break
      }
    }

    // ── Keyword-only topics (fees / placements / scholarship) ─────────────────
    for (const type of ['fees', 'placements', 'scholarship'] as const) {
      if (numericTypes.has(type)) continue
      const kws = ENTITY_KEYWORDS[type] ?? []
      const hit = kws.find((kw) => padded(normalized).includes(padded(kw)))
      if (hit) entities.push({ type, value: hit, normalized: hit, raw: hit, confidence: 0.8 })
    }

    // ── Colleges ──────────────────────────────────────────────────────────────
    const colleges = extractColleges(normalized)
    for (const c of colleges) {
      entities.push({ type: 'college', value: c.name, normalized: c.name, raw: c.name, confidence: 0.9 })
    }

    return { entities, colleges, branch, community, studentCutoff, location }
  }

  return Object.freeze({ extract })
}
