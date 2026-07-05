/**
 * @module lib/opinion/generator/opinion-generator
 *
 * Opinion Generator (Module 3). Produces STRUCTURED, grounded recommendation
 * objects — {recommendation, reasoning, evidence ids, confidence, trade-offs,
 * risks} — DETERMINISTICALLY from the opinion context. It never calls an LLM and
 * never hardcodes a recommendation: every one is derived from the retrieved
 * evidence. When there is no backing evidence it emits a single `insufficient`
 * recommendation. No AI.
 */

import { slugify } from '@/lib/knowledge'
import { DIMENSION_LABEL, type EligibilityCategory } from '@/lib/recommendation'
import type { ConfidenceLevel } from '@/lib/ai/orchestration'
import { SUBSTANTIVE_DIMENSIONS, type OpinionConfig } from '../config'
import type {
  CollegeDossier,
  OpinionContext,
  OpinionRecommendation,
  OpinionResult,
  Priority,
  RecommendationKind,
} from '../models'

const CONF_RANK: Readonly<Record<ConfidenceLevel, number>> = { low: 0, medium: 1, high: 2 }
const CONF_BY_RANK: readonly ConfidenceLevel[] = ['low', 'medium', 'high']

const unique = (values: readonly string[]): string[] => [...new Set(values)]
const minConfidence = (levels: readonly ConfidenceLevel[]): ConfidenceLevel =>
  levels.length === 0 ? 'low' : CONF_BY_RANK[Math.min(...levels.map((l) => CONF_RANK[l]))]
const downgrade = (level: ConfidenceLevel): ConfidenceLevel => CONF_BY_RANK[Math.max(0, CONF_RANK[level] - 1)]

const recId = (kind: string, colleges: readonly string[]): string =>
  `rec:${kind}:${slugify(colleges.join(' ') || 'none')}`

/** Render rupees as a readable lakh figure: 400000 → "4L", 680000 → "6.8L". */
function lakh(rupees: number): string {
  const l = rupees / 100000
  return `${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`
}

/** Concrete, grounded reasons for a single college — concise fact fragments a
 *  counselor would actually say (no per-cohort/patent noise). */
function reasonsFor(dossier: CollegeDossier): string[] {
  const rs: string[] = []
  if (dossier.strengths.length > 0) {
    rs.push(`strong ${dossier.strengths.map((d) => DIMENSION_LABEL[d].toLowerCase()).join(' and ')}`)
  }
  const p = dossier.placement
  if (p?.medianSalary != null) rs.push(`₹${lakh(p.medianSalary)} median salary`)
  if (p?.placementPercentage != null) rs.push(`${Math.round(p.placementPercentage)}% placement`)
  return rs
}

/** Trade-offs for a single college (its weaknesses). */
function tradeoffsFor(dossier: CollegeDossier): string[] {
  if (dossier.weaknesses.length === 0) return []
  return [`Relatively weaker ${dossier.weaknesses.map((d) => DIMENSION_LABEL[d].toLowerCase()).join(' and ')}.`]
}

/** Risks/caveats for a single college. */
function risksFor(dossier: CollegeDossier, priorities: readonly Priority[]): string[] {
  const rs: string[] = []
  const cat = dossier.eligibility?.category
  if (cat === 'dream' || cat === 'reach') rs.push('Admission is a stretch — at or below the historical closing cutoff.')
  else if (!dossier.eligibility || cat === 'unknown') rs.push('Eligibility is unconfirmed (no historical cutoff data).')
  if (dossier.confidence === 'low') rs.push('Limited data — treat this with caution.')
  if (priorities.includes('budget')) rs.push('Tuition fees are not available in the dataset.')
  return rs
}

const band = (c: EligibilityCategory | undefined): 'safe' | 'moderate' | 'dream' | 'unknown' =>
  c === 'safe' ? 'safe' : c === 'target' ? 'moderate' : c === 'reach' || c === 'dream' ? 'dream' : 'unknown'

const HEADLINE: Readonly<Record<RecommendationKind, string>> = {
  top_pick: 'Recommended pick',
  safe: 'Safe choices',
  moderate: 'Balanced choices',
  dream: 'Ambitious options',
  alternative: 'Also worth considering',
  comparison: 'Comparison',
  insufficient: 'Insufficient evidence',
}

/** Build one recommendation object over a set of dossiers. */
function bucket(
  kind: RecommendationKind,
  dossiers: readonly CollegeDossier[],
  priorities: readonly Priority[],
  extraRisks: readonly string[] = [],
  headline?: string,
): OpinionRecommendation {
  const colleges = dossiers.map((d) => d.college.name)
  const reasoning = unique(dossiers.flatMap((d) => [`${d.college.name}: ${reasonsFor(d).join(', ')}`.trim()]))
  const tradeoffs = unique(dossiers.flatMap((d) => tradeoffsFor(d).map((t) => `${d.college.name}: ${t}`)))
  const risks = unique([...dossiers.flatMap((d) => risksFor(d, priorities)), ...extraRisks])
  return {
    id: recId(kind, colleges),
    kind,
    colleges,
    headline: headline ?? HEADLINE[kind],
    reasoning,
    evidenceIds: unique(dossiers.flatMap((d) => d.evidenceIds)),
    confidence: minConfidence(dossiers.map((d) => d.confidence)),
    tradeoffs,
    risks,
  }
}

/** Quality-ranked recommendations: a top pick + alternatives. */
function qualityRecommendations(
  context: OpinionContext,
  extraRisks: readonly string[] = [],
): OpinionRecommendation[] {
  const [top, ...rest] = context.candidates
  if (!top) return []
  const recs: OpinionRecommendation[] = [bucket('top_pick', [top], context.priorities, extraRisks)]
  const alternatives = rest.slice(0, 3)
  if (alternatives.length > 0) recs.push(bucket('alternative', alternatives, context.priorities, extraRisks))
  return recs
}

/** Comparison recommendation: winner + per-dimension leads + trade-offs. */
function comparisonRecommendation(context: OpinionContext): OpinionRecommendation | null {
  const cmp = context.comparison
  if (!cmp || cmp.colleges.length < 2) return null
  const names = cmp.colleges.map((c) => c.name)
  const dimWins = cmp.dimensions.filter((d) => d.winner && SUBSTANTIVE_DIMENSIONS.includes(d.dimension))

  // Each college's winning dimensions, stated ONCE (no per-dimension + grouped repeat).
  const winsBy = new Map<string, string[]>()
  for (const d of dimWins) {
    const arr = winsBy.get(d.winner!.name) ?? []
    arr.push(DIMENSION_LABEL[d.dimension].toLowerCase())
    winsBy.set(d.winner!.name, arr)
  }
  const reasoning: string[] = [...winsBy.entries()].map(([name, dims]) => `${name} is stronger on ${dims.join(', ')}.`)

  // Admission difficulty from the historical closing cutoffs (higher = harder to get).
  const cutoffs = new Map<string, number>()
  for (const d of context.candidates) {
    if (d.eligibility?.closingCutoff != null) cutoffs.set(d.college.name, d.eligibility.closingCutoff)
  }
  if (cutoffs.size === 2) {
    const [[na, ca], [nb, cb]] = [...cutoffs.entries()]
    if (ca !== cb) reasoning.push(`${ca > cb ? na : nb} is harder to get into (higher closing cutoff).`)
  }

  // Clear verdict.
  reasoning.push(
    cmp.winner
      ? `On balance I'd lean towards ${cmp.winner.name}, though ${names.find((n) => n !== cmp.winner!.name)} is a strong alternative.`
      : 'The two are closely matched — either is a sound choice.',
  )

  const noData = cmp.dimensions
    .filter((d) => !d.winner && SUBSTANTIVE_DIMENSIONS.includes(d.dimension))
    .map((d) => DIMENSION_LABEL[d.dimension].toLowerCase())
  const risks = [
    ...(noData.length > 0 ? [`I don't have comparable data on ${noData.join(', ')} for both.`] : []),
    'Fees and campus life are not in the dataset — weigh those separately.',
  ]

  return {
    id: recId('comparison', names),
    kind: 'comparison',
    colleges: names,
    headline: `${HEADLINE.comparison}: ${names.join(' vs ')}`,
    reasoning,
    evidenceIds: unique(context.candidates.flatMap((c) => c.evidenceIds)),
    confidence: minConfidence(context.candidates.map((c) => c.confidence)),
    tradeoffs: [], // folded into `reasoning` to avoid repeating each strength twice
    risks,
  }
}

/** Eligibility-band recommendations, or quality fallback when cutoffs are unknown. */
function eligibilityRecommendations(context: OpinionContext): OpinionRecommendation[] {
  const groups: Record<'safe' | 'moderate' | 'dream', CollegeDossier[]> = { safe: [], moderate: [], dream: [] }
  let known = 0
  for (const d of context.candidates) {
    const b = band(d.eligibility?.category)
    if (b === 'unknown') continue
    known += 1
    groups[b].push(d)
  }
  if (known === 0) {
    // No cutoff dataset → recommend by quality with an explicit eligibility caveat.
    return qualityRecommendations(context, ['Eligibility could not be confirmed — no historical cutoff data is available.'])
  }
  const recs: OpinionRecommendation[] = []
  if (groups.safe.length > 0) recs.push(bucket('safe', groups.safe, context.priorities, ['These clear the historical closing cutoff comfortably.']))
  if (groups.moderate.length > 0) recs.push(bucket('moderate', groups.moderate, context.priorities))
  if (groups.dream.length > 0) recs.push(bucket('dream', groups.dream, context.priorities, ['Admission is not guaranteed — these are at or below your cutoff historically.']))
  return recs
}

/** Generate the deterministic opinion result. */
export function generateOpinions(context: OpinionContext, _config: OpinionConfig): OpinionResult {
  if (context.candidates.length === 0) {
    const insufficient: OpinionRecommendation = {
      id: recId('insufficient', []),
      kind: 'insufficient',
      colleges: [],
      headline: HEADLINE.insufficient,
      reasoning: ['No candidate colleges matched this query with the available evidence.'],
      evidenceIds: [],
      confidence: 'low',
      tradeoffs: [],
      risks: ['There is not enough evidence to make a confident recommendation.'],
    }
    return {
      strategy: 'insufficient_evidence',
      recommendations: [insufficient],
      confidence: 'low',
      missingInformation: context.missingInformation,
      evidenceIds: [],
    }
  }

  let recommendations: OpinionRecommendation[]
  switch (context.strategy) {
    case 'comparison': {
      const rec = comparisonRecommendation(context)
      recommendations = rec ? [rec] : qualityRecommendations(context)
      break
    }
    case 'eligibility_bands':
      recommendations = eligibilityRecommendations(context)
      break
    case 'branch_recommendation':
      recommendations = qualityRecommendations(context, [
        'Branch-level data is unavailable; ranked by overall college quality.',
      ])
      break
    default:
      recommendations = qualityRecommendations(context)
  }

  const hasBlocking = context.missingInformation.some((m) => m.severity === 'blocking')
  const top = recommendations[0]?.confidence ?? 'low'
  const confidence = hasBlocking ? downgrade(top) : top

  return {
    strategy: context.candidates.length === 0 ? 'insufficient_evidence' : context.strategy,
    recommendations,
    confidence,
    missingInformation: context.missingInformation,
    evidenceIds: unique(recommendations.flatMap((r) => r.evidenceIds)),
  }
}
