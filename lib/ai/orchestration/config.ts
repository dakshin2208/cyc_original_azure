/**
 * @module lib/ai/orchestration/config
 *
 * Central configuration for the AI Orchestration Layer — evidence-confidence
 * weights, confidence bands, source ranking, and prompt budgets. Nothing
 * downstream is hardcoded; callers may pass a partial override. No AI.
 */

import type { ReasonStrength } from '@/lib/recommendation'
import type { ConfidenceLevel, EvidenceSource } from './models'

/** Confidence assigned to evidence by its kind. */
export interface EvidenceConfidence {
  readonly strong: number
  readonly moderate: number
  readonly weak: number
  /** A concrete retrieved fact with a value. */
  readonly fact: number
  /** A retrieved fact whose value is unavailable (`null`). */
  readonly factMissing: number
  /** A comparison winner. */
  readonly comparison: number
}

/** Thresholds that map a [0,1] confidence to a band. */
export interface ConfidenceBands {
  readonly high: number
  readonly medium: number
}

/** The complete orchestration configuration. */
export interface OrchestrationConfig {
  readonly evidenceConfidence: EvidenceConfidence
  readonly confidenceBands: ConfidenceBands
  /** Relative rank of each source when ordering evidence (higher first). */
  readonly sourceRank: Readonly<Record<EvidenceSource, number>>
  /** Max recommendations serialized into a prompt. */
  readonly maxRecommendationsInPrompt: number
  /** Max evidence items serialized into a prompt. */
  readonly maxEvidenceInPrompt: number
  /** Default number of recommendations to request from the engine. */
  readonly defaultRecommendationLimit: number
}

/** The default configuration. */
export const defaultOrchestrationConfig: OrchestrationConfig = {
  evidenceConfidence: {
    strong: 0.9,
    moderate: 0.7,
    weak: 0.5,
    fact: 0.95,
    factMissing: 0.3,
    comparison: 0.8,
  },
  confidenceBands: { high: 0.75, medium: 0.5 },
  sourceRank: { retrieval: 4, recommendation: 3, comparison: 2, warehouse: 1 },
  maxRecommendationsInPrompt: 5,
  maxEvidenceInPrompt: 24,
  defaultRecommendationLimit: 5,
}

/** Map a [0,1] confidence value to a band. */
export function bandOf(value: number, bands: ConfidenceBands): ConfidenceLevel {
  if (value >= bands.high) return 'high'
  if (value >= bands.medium) return 'medium'
  return 'low'
}

/** Map a reason strength to its evidence confidence. */
export function confidenceForStrength(strength: ReasonStrength, cfg: EvidenceConfidence): number {
  return strength === 'strong' ? cfg.strong : strength === 'moderate' ? cfg.moderate : cfg.weak
}

/** A one-level-deep partial for overrides. */
export type PartialOrchestrationConfig = {
  readonly [K in keyof OrchestrationConfig]?: OrchestrationConfig[K] extends object
    ? Partial<OrchestrationConfig[K]>
    : OrchestrationConfig[K]
}

/** Resolve a partial override onto the defaults. */
export function resolveOrchestrationConfig(
  override?: PartialOrchestrationConfig,
): OrchestrationConfig {
  if (!override) return defaultOrchestrationConfig
  const d = defaultOrchestrationConfig
  return {
    evidenceConfidence: { ...d.evidenceConfidence, ...override.evidenceConfidence },
    confidenceBands: { ...d.confidenceBands, ...override.confidenceBands },
    sourceRank: { ...d.sourceRank, ...override.sourceRank },
    maxRecommendationsInPrompt: override.maxRecommendationsInPrompt ?? d.maxRecommendationsInPrompt,
    maxEvidenceInPrompt: override.maxEvidenceInPrompt ?? d.maxEvidenceInPrompt,
    defaultRecommendationLimit: override.defaultRecommendationLimit ?? d.defaultRecommendationLimit,
  }
}
