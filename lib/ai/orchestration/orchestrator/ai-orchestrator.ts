/**
 * @module lib/ai/orchestration/orchestrator/ai-orchestrator
 *
 * AIOrchestrator (Module 2) — the composition root of the AI Orchestration Layer.
 * It parses the question, routes to the DETERMINISTIC engines (Recommendation,
 * Comparison, Retrieval) by intent, gracefully handles any engine failure,
 * collects evidence, builds the context, and assembles the LLM-ready prompt. It
 * NEVER calls an LLM, and it never ranks/compares/computes itself — the engines
 * do. Deterministic; no AI.
 */

import type { CanonicalCollege, KnowledgeRepositories } from '@/lib/knowledge'
import type { RetrievalEngine } from '@/lib/retrieval'
import {
  createRecommendationEngine,
  type CollegeProfile,
  type ComparisonResult,
  type CutoffLookup,
  type RecommendationEngine,
  type RecommendationResult,
} from '@/lib/recommendation'
import { sessionId } from '@/lib/ai/shared'
import {
  resolveOrchestrationConfig,
  type OrchestrationConfig,
  type PartialOrchestrationConfig,
} from '../config'
import { createContextBuilder, type ContextBuilder } from '../context'
import { applyTurn, createConversationState } from '../conversation'
import { createEvidenceCollector, type EvidenceCollector } from '../evidence'
import { createPromptBuilder, type PromptBuilder } from '../prompt'
import { createQueryLexicon, createQueryParser, type QueryParser } from '../query'
import type {
  ContextPackage,
  ConversationState,
  ParsedQuery,
  QueryOverrides,
  PromptPackage,
  QueryIntent,
  RetrievedFact,
} from '../models'

/** The full result of orchestrating one question. */
export interface OrchestrationResult {
  readonly parsed: ParsedQuery
  readonly context: ContextPackage
  readonly prompt: PromptPackage
  /** The conversation state advanced by this turn. */
  readonly state: ConversationState
}

/** Options for constructing the orchestrator. */
export interface AIOrchestratorOptions {
  readonly config?: PartialOrchestrationConfig
  /** Injected historical-cutoff source for eligibility (defaults to none). */
  readonly cutoffs?: CutoffLookup
  /** Override the recommendation engine (advanced/testing). */
  readonly reco?: RecommendationEngine
}

/** The public AIOrchestrator API. */
export interface AIOrchestrator {
  readonly config: OrchestrationConfig
  readonly reco: RecommendationEngine
  /** Deterministically parse a question (query understanding only). */
  parse(question: string): ParsedQuery
  /**
   * Full pipeline: parse → engines → evidence → context → prompt (+ state).
   * `overrides` fill fields the message did not state (e.g. a stored profile).
   */
  orchestrate(
    question: string,
    priorState?: ConversationState,
    overrides?: QueryOverrides,
  ): OrchestrationResult
}

/** Internal aggregate of what the engines produced for one query. */
interface EngineOutputs {
  readonly subjects: readonly CanonicalCollege[]
  readonly recommendations: readonly RecommendationResult[]
  readonly comparison: ComparisonResult | null
  readonly facts: readonly RetrievedFact[]
  readonly notes: readonly string[]
}

/** Extract the intent-relevant facts from a college profile (concrete values). */
function factsFor(profile: CollegeProfile, intent: QueryIntent): RetrievedFact[] {
  const name = profile.college.name
  const out: RetrievedFact[] = []
  const add = (label: string, value: string | number | null, origin: string): void => {
    out.push({ collegeName: name, label, value: value ?? null, origin })
  }
  const all = intent === 'general_information'
  if (intent === 'placement_query' || intent === 'roi_query' || intent === 'compare_colleges' || all) {
    add('Median salary (INR/yr)', profile.placement?.medianSalary ?? null, 'placement')
    add('Placement rate (%)', profile.placement?.placementPercentage ?? null, 'placement')
    add('Highest median salary (INR/yr)', profile.placement?.highestMedianSalary ?? null, 'placement')
  }
  if (intent === 'research_query' || all) {
    add('Patents published', profile.research?.patentsPublished ?? null, 'research')
    add('Sponsored projects', profile.research?.sponsoredProjects ?? null, 'research')
    add('PhDs graduated', profile.research?.phdGraduated ?? null, 'research')
  }
  if (intent === 'faculty_query' || intent === 'compare_colleges' || all) {
    add('Total faculty', profile.faculty?.total ?? null, 'faculty')
    add('Faculty with PhD', profile.faculty?.withPhd ?? null, 'faculty')
  }
  if (intent === 'roi_query' || all) {
    add('Operating expenditure (INR)', profile.finance?.operatingExpenditure ?? null, 'finance')
  }
  if (intent === 'nirf_query' || all) {
    add('NIRF category', profile.institution?.category ?? null, 'nirf')
    add('NIRF ranked', profile.college.hasNirfData ? 'yes' : 'no', 'nirf')
  }
  if (intent === 'cutoff_query' || intent === 'eligibility_query') {
    add('Closing cutoff', null, 'cutoff') // no cutoff dataset — explicitly unavailable
  }
  return out
}

/** Create the AI Orchestrator over the deterministic engines. */
export function createAIOrchestrator(
  repos: KnowledgeRepositories,
  retrieval: RetrievalEngine,
  options: AIOrchestratorOptions = {},
): AIOrchestrator {
  const config = resolveOrchestrationConfig(options.config)
  const reco =
    options.reco ?? createRecommendationEngine(repos, retrieval, { cutoffs: options.cutoffs })

  const lexicon = createQueryLexicon(repos, retrieval)
  const parser: QueryParser = createQueryParser(lexicon)
  const collector: EvidenceCollector = createEvidenceCollector(config)
  const contextBuilder: ContextBuilder = createContextBuilder(config)
  const promptBuilder: PromptBuilder = createPromptBuilder(config)
  const limit = config.defaultRecommendationLimit

  const resolveSubjects = (parsed: ParsedQuery): CanonicalCollege[] =>
    parsed.colleges
      .map((n) => reco.profiles.getByExactName(n)?.college ?? null)
      .filter((c): c is CanonicalCollege => c !== null)

  const runEngines = (parsed: ParsedQuery): EngineOutputs => {
    const notes: string[] = []
    const subjects = resolveSubjects(parsed)
    const subjectIds = new Set(subjects.map((s) => s.id))
    let recommendations: readonly RecommendationResult[] = []
    let comparison: ComparisonResult | null = null

    const safe = <T,>(label: string, fn: () => T, fallback: T): T => {
      try {
        return fn()
      } catch (e) {
        notes.push(`engine "${label}" failed and was skipped: ${(e as Error).message}`)
        return fallback
      }
    }

    const category = parsed.entities.find((e) => e.type === 'category')?.value
    const isGov = category === 'government' || category === 'govt'
    const isPriv = category === 'private'
    const opts = {
      limit,
      district: parsed.location ?? undefined,
      studentCutoff: parsed.studentCutoff ?? undefined,
      community: parsed.community ?? undefined,
    }

    switch (parsed.intent) {
      case 'recommend_college':
        recommendations = safe('recommend', () => {
          if (isGov) return reco.recommendGovernmentColleges(opts)
          if (isPriv) return reco.recommendPrivateColleges(opts)
          if (parsed.branch) return reco.recommendByBranch(parsed.branch, opts)
          if (parsed.studentCutoff !== null && parsed.community !== null) {
            return reco.recommendByCutoff(parsed.studentCutoff, parsed.community, opts)
          }
          return reco.recommendBestCollege(opts)
        }, [])
        break
      case 'branch_advice':
        recommendations = safe('branch_advice', () =>
          parsed.branch ? reco.recommendByBranch(parsed.branch, opts) : reco.recommendBestCollege(opts),
        [])
        break
      case 'compare_colleges':
        if (subjects.length >= 2) comparison = safe('compare', () => reco.compareColleges(subjects), null)
        break
      case 'placement_query':
        if (subjects.length === 0) recommendations = safe('best_placement', () => reco.recommendBestPlacement(opts), [])
        break
      case 'research_query':
        if (subjects.length === 0) recommendations = safe('best_research', () => reco.recommendBestResearch(opts), [])
        break
      case 'faculty_query':
        if (subjects.length === 0) recommendations = safe('best_faculty', () => reco.recommendBestFaculty(opts), [])
        break
      case 'roi_query':
        recommendations = safe('best_roi', () => reco.recommendBestROI(opts), [])
        break
      case 'nirf_query':
        if (subjects.length === 0) recommendations = safe('best_overall', () => reco.recommendBestCollege(opts), [])
        break
      case 'eligibility_query':
      case 'cutoff_query':
        if (parsed.studentCutoff !== null && parsed.community !== null) {
          const full = safe('by_cutoff', () =>
            reco.recommendByCutoff(parsed.studentCutoff as number, parsed.community!, {
              limit: 1000,
              district: parsed.location ?? undefined,
            }),
          [])
          recommendations =
            subjects.length > 0 ? full.filter((r) => subjectIds.has(r.college.id)) : full.slice(0, limit)
        }
        break
      case 'general_information':
      case 'unknown':
      default:
        break
    }

    const facts: RetrievedFact[] = []
    for (const s of subjects) {
      const profile = safe('profile', () => reco.profiles.getProfile(s), null)
      if (profile) facts.push(...factsFor(profile, parsed.intent))
    }

    return { subjects, recommendations, comparison, facts, notes }
  }

  // Fill fields the message did not state from the (profile) overrides; a value the
  // message states always wins. Only the recommendation-driving fields are merged.
  const applyOverrides = (parsed: ParsedQuery, o?: QueryOverrides): ParsedQuery =>
    o
      ? {
          ...parsed,
          studentCutoff: parsed.studentCutoff ?? o.studentCutoff ?? null,
          community: parsed.community ?? o.community ?? null,
          branch: parsed.branch ?? o.branch ?? null,
          location: parsed.location ?? o.location ?? null,
        }
      : parsed

  const orchestrate = (
    question: string,
    priorState?: ConversationState,
    overrides?: QueryOverrides,
  ): OrchestrationResult => {
    const parsed = applyOverrides(parser.parse(question), overrides)
    const eng = runEngines(parsed)
    const evidence = collector.collect({
      recommendations: eng.recommendations,
      comparison: eng.comparison,
      facts: eng.facts,
    })
    const context = contextBuilder.build({
      parsed,
      subjects: eng.subjects,
      recommendations: eng.recommendations,
      comparison: eng.comparison,
      facts: eng.facts,
      evidence,
      extraNotes: eng.notes,
    })
    const prompt = promptBuilder.build(context, question)
    const base = priorState ?? createConversationState(sessionId('session'))
    const state = applyTurn(base, parsed, context)
    return { parsed, context, prompt, state }
  }

  return Object.freeze({
    config,
    reco,
    parse: (question) => parser.parse(question),
    orchestrate,
  })
}
