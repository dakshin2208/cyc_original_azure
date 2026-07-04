/**
 * @module lib/ai/orchestration/context/context-builder
 *
 * ContextBuilder (Module 3) — assembles the single structured {@link ContextPackage}
 * from the parsed query, the deterministic engine outputs, and the collected
 * evidence. It derives missing-information gaps and follow-up questions from fixed
 * templates. It NEVER generates prompt text and calls no LLM.
 */

import type { CanonicalCollege } from '@/lib/knowledge'
import type { ComparisonResult, RecommendationResult } from '@/lib/recommendation'
import { bandOf, type OrchestrationConfig } from '../config'
import type {
  ContextConfidence,
  ContextPackage,
  EvidencePackage,
  FollowUpQuestion,
  MissingInformation,
  ParsedQuery,
  RetrievedFact,
} from '../models'

/** Everything the builder needs (engine outputs are pre-computed by the orchestrator). */
export interface ContextInput {
  readonly parsed: ParsedQuery
  readonly subjects: readonly CanonicalCollege[]
  readonly recommendations: readonly RecommendationResult[]
  readonly comparison: ComparisonResult | null
  readonly facts: readonly RetrievedFact[]
  readonly evidence: EvidencePackage
  /** Orchestrator-level caveats (e.g. a gracefully-handled engine failure). */
  readonly extraNotes?: readonly string[]
}

/** The ContextBuilder component. */
export interface ContextBuilder {
  build(input: ContextInput): ContextPackage
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Derive information gaps + follow-up questions deterministically from the query. */
function deriveGaps(input: ContextInput): {
  missing: MissingInformation[]
  followUps: FollowUpQuestion[]
} {
  const { parsed, subjects, recommendations } = input
  const missing: MissingInformation[] = []
  const followUps: FollowUpQuestion[] = []
  const need = (m: MissingInformation, q: FollowUpQuestion | null): void => {
    missing.push(m)
    if (q) followUps.push(q)
  }

  // Eligibility / cutoff intents need cutoff + community, and lack a cutoff dataset.
  if (parsed.intent === 'eligibility_query' || parsed.intent === 'cutoff_query') {
    if (parsed.studentCutoff === null) {
      need(
        { field: 'cutoff', severity: 'blocking', reason: 'a student cutoff mark is required to assess eligibility' },
        { question: 'What is your cutoff mark (out of 200)?', expects: 'cutoff', reason: 'needed to assess eligibility' },
      )
    }
    if (parsed.community === null) {
      need(
        { field: 'community', severity: 'blocking', reason: 'a reservation community is required to assess eligibility' },
        { question: 'Which community do you belong to (OC/BC/MBC/SC/ST)?', expects: 'community', reason: 'cutoffs vary by community' },
      )
    }
    missing.push({
      field: 'cutoff_dataset',
      severity: 'degraded',
      reason: 'no historical closing-cutoff dataset is wired; eligibility is reported as unknown',
    })
  }

  // Comparison needs at least two colleges.
  if (parsed.intent === 'compare_colleges' && subjects.length < 2) {
    need(
      { field: 'college', severity: 'blocking', reason: 'at least two colleges are required to compare' },
      { question: 'Which colleges would you like to compare?', expects: 'college', reason: 'a comparison needs two or more named colleges' },
    )
  }

  // Branch advice benefits from a named branch.
  if (parsed.intent === 'branch_advice' && parsed.branch === null) {
    need(
      { field: 'branch', severity: 'degraded', reason: 'no branch was named' },
      { question: 'Which branch(es) are you considering?', expects: 'branch', reason: 'branch advice is branch-specific' },
    )
  }

  // Single-college fact intents benefit from a named college when none resolved.
  const factIntents = ['placement_query', 'research_query', 'faculty_query', 'nirf_query']
  if (factIntents.includes(parsed.intent) && subjects.length === 0 && recommendations.length === 0) {
    need(
      { field: 'college', severity: 'degraded', reason: 'no specific college was identified' },
      { question: 'Which college are you asking about?', expects: 'college', reason: 'the question targets a specific college' },
    )
  }

  // Fees / scholarship are not in the dataset.
  if (parsed.entities.some((e) => e.type === 'fees')) {
    missing.push({ field: 'fees_dataset', severity: 'degraded', reason: 'tuition fees are not present in the dataset' })
  }
  if (parsed.entities.some((e) => e.type === 'scholarship')) {
    missing.push({ field: 'fees_dataset', severity: 'degraded', reason: 'scholarship data is not present in the dataset' })
  }

  // Branch context cannot be used to filter (no per-college branch linkage).
  if (parsed.branch !== null && (parsed.intent === 'recommend_college' || parsed.intent === 'branch_advice')) {
    missing.push({ field: 'branch_linkage', severity: 'informational', reason: 'no per-college branch linkage; branch is context only' })
  }

  return { missing, followUps }
}

/** Create the context builder bound to a resolved config. */
export function createContextBuilder(config: OrchestrationConfig): ContextBuilder {
  const build = (input: ContextInput): ContextPackage => {
    const { parsed, evidence } = input
    const { missing, followUps } = deriveGaps(input)

    // Confidence = blend of intent confidence and value-bearing evidence share.
    const valueBearing = evidence.items.filter((e) => e.value !== null).length
    const evidenceCompleteness = evidence.count > 0 ? valueBearing / evidence.count : 0
    const overall =
      parsed.intent === 'unknown'
        ? 0.15
        : clamp01(0.4 * parsed.intentConfidence + 0.6 * evidenceCompleteness)
    const confidence: ContextConfidence = {
      overall,
      level: bandOf(overall, config.confidenceBands),
      evidenceCompleteness,
    }

    // Notes: distinct caveats from the recommendation engine + orchestrator.
    const notes = Array.from(
      new Set([...input.recommendations.flatMap((r) => r.notes), ...(input.extraNotes ?? [])]),
    )

    return {
      intent: parsed.intent,
      intentConfidence: parsed.intentConfidence,
      entities: parsed.entities,
      subjects: input.subjects,
      recommendations: input.recommendations,
      comparison: input.comparison,
      facts: input.facts,
      evidence,
      confidence,
      missingInformation: missing,
      followUpQuestions: followUps,
      notes,
    }
  }

  return Object.freeze({ build })
}
