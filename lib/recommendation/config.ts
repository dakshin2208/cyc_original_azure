/**
 * @module lib/recommendation/config
 *
 * Central configuration for the Recommendation Engine. ALL scoring weights,
 * normalization references, eligibility thresholds, confidence bands, and reason
 * thresholds live here — nothing is hardcoded in the engines. Callers may pass a
 * partial override that is deep-merged onto {@link defaultConfig}.
 */

import type { ReputationTier, ScoreDimension } from './models/enums'

/** Per-dimension weights (relative; the scorer normalizes by the active sum). */
export type DimensionWeights = Readonly<Record<ScoreDimension, number>>

/** Reference maxima used to normalize each raw metric into [0, 1]. */
export interface NormalizationRefs {
  readonly medianSalaryRef: number
  readonly researchPatentsRef: number
  readonly researchProjectsRef: number
  readonly researchPhdRef: number
  readonly capitalExpenditureRef: number
  readonly operatingExpenditureRef: number
  readonly academicPhdScholarsRef: number
  readonly facultySizeRef: number
  /** Selectivity floor: OC cutoff at/below which selectivity scores 0 (TNEA aggregate marks). */
  readonly selectivityMinCutoff: number
  /** Selectivity ceiling: OC cutoff at/above which selectivity scores 1 (TNEA max = 200). */
  readonly selectivityMaxCutoff: number
}

/** Eligibility thresholds, expressed in cutoff marks. */
export interface EligibilityThresholds {
  /** Margin above the closing cutoff to be considered SAFE. */
  readonly safeMargin: number
  /** Margin below the closing cutoff still considered a REACH. */
  readonly reachMargin: number
}

/**
 * Reputation-tier configuration. A college's tier is derived from its OC closing
 * cutoff (a strong demand/reputation proxy) and floored by a curated, evidence-
 * justified seed for well-known colleges whose data is too sparse to tier correctly.
 * The tier is embedded as a disjoint band in the ranking total so higher tiers
 * dominate marginal score differences ("tiers dominate; scores refine").
 */
export interface ReputationConfig {
  /** OC-cutoff thresholds (TNEA marks, 0–200) at each tier boundary. */
  readonly cutoffBands: {
    readonly elite: number
    readonly strong: number
    readonly good: number
    readonly emerging: number
  }
  /** Base of each tier's score band (disjoint, descending). */
  readonly bandBase: Readonly<Record<ReputationTier, number>>
  /** Width of each tier band; within a band the raw score refines the rank. */
  readonly bandSpan: number
  /**
   * Curated floor: `[nameSlug fragment, minimum tier]`. Lifts known colleges whose
   * data is too sparse to tier by cutoff alone (e.g. PSG's blank 2026 row). Each entry
   * is justified by external evidence (multi-year top-percentile closing cutoffs +
   * NIRF standing + established placement). NEVER demotes — a floor only.
   */
  readonly seed: readonly (readonly [string, ReputationTier])[]
}

/** Confidence banding thresholds (over data completeness in [0, 1]). */
export interface ConfidenceConfig {
  readonly highThreshold: number
  readonly mediumThreshold: number
}

/** Reason-strength thresholds (over normalized dimension score in [0, 1]). */
export interface ReasonThresholds {
  readonly strong: number
  readonly moderate: number
}

/** The complete recommendation configuration. */
export interface RecommendationConfig {
  /** Default (best-overall) weights. */
  readonly weights: DimensionWeights
  /** Per-category weight profiles. */
  readonly strategyWeights: Readonly<Record<string, DimensionWeights>>
  readonly normalization: NormalizationRefs
  readonly eligibility: EligibilityThresholds
  readonly reputation: ReputationConfig
  readonly confidence: ConfidenceConfig
  readonly reasons: ReasonThresholds
  /** Name fragments (lowercase) that classify a college as government. */
  readonly governmentKeywords: readonly string[]
  /** Default result limit. */
  readonly defaultLimit: number
}

/** Base weights used for best-overall and as the emphasis base. */
const BASE_WEIGHTS: DimensionWeights = {
  placement: 3,
  faculty: 2,
  research: 2,
  infrastructure: 1.5,
  financialStrength: 1,
  academicReputation: 2,
  // Selectivity (OC-cutoff demand proxy) — a strong reputation signal a counselor
  // weighs heavily; the single biggest corrective to reputation-blind ranking.
  selectivity: 3,
  nirfPresence: 1,
  availableBranches: 0.5,
  dataCompleteness: 1.5,
}

/** Return a copy of `base` with the given dimensions multiplied by `factor`. */
function emphasize(
  base: DimensionWeights,
  dimensions: readonly ScoreDimension[],
  factor: number,
): DimensionWeights {
  const out: Record<ScoreDimension, number> = { ...base }
  for (const d of dimensions) out[d] = base[d] * factor
  return out
}

/** The default configuration. */
export const defaultConfig: RecommendationConfig = {
  weights: BASE_WEIGHTS,
  strategyWeights: {
    best_overall: BASE_WEIGHTS,
    best_placement: emphasize(BASE_WEIGHTS, ['placement'], 3),
    best_research: emphasize(BASE_WEIGHTS, ['research'], 3),
    best_faculty: emphasize(BASE_WEIGHTS, ['faculty'], 3),
    best_infrastructure: emphasize(BASE_WEIGHTS, ['infrastructure'], 3),
    best_roi: emphasize(BASE_WEIGHTS, ['placement', 'financialStrength'], 2),
    higher_studies: emphasize(BASE_WEIGHTS, ['research', 'faculty', 'academicReputation'], 2),
    government_jobs: emphasize(BASE_WEIGHTS, ['academicReputation', 'faculty'], 2),
    private_college: BASE_WEIGHTS,
    government_college: BASE_WEIGHTS,
    by_branch: BASE_WEIGHTS,
    by_cutoff: BASE_WEIGHTS,
  },
  normalization: {
    medianSalaryRef: 1_200_000,
    researchPatentsRef: 50,
    researchProjectsRef: 50,
    researchPhdRef: 100,
    capitalExpenditureRef: 500_000_000,
    operatingExpenditureRef: 2_000_000_000,
    academicPhdScholarsRef: 500,
    facultySizeRef: 500,
    selectivityMinCutoff: 100,
    selectivityMaxCutoff: 200,
  },
  eligibility: { safeMargin: 8, reachMargin: 5 },
  reputation: {
    cutoffBands: { elite: 194, strong: 184, good: 168, emerging: 150 },
    bandBase: { elite: 0.8, strong: 0.6, good: 0.4, emerging: 0.2, regional: 0.0 },
    bandSpan: 0.19,
    // Evidence-justified floors for marquee colleges whose 2026 rows are sparse/blank.
    // Justification: each has sat in the top TNEA closing-cutoff percentile for years,
    // is NIRF-ranked, and has an established placement/brand record.
    seed: [
      ['psg-college-of-technology', 'elite'],
      ['coimbatore-institute-of-technology', 'elite'],
      ['college-of-engineering-guindy', 'elite'],
      ['thiagarajar-college-of-engineering', 'elite'],
      ['sri-sivasubramaniya-nadar-college-of-engineering', 'elite'],
      ['madras-institute-of-technology', 'strong'],
    ],
  },
  confidence: { highThreshold: 0.75, mediumThreshold: 0.45 },
  reasons: { strong: 0.75, moderate: 0.5 },
  governmentKeywords: [
    'government',
    'govt',
    'university departments',
    'anna university',
    'national institute',
    'indian institute of',
  ],
  defaultLimit: 10,
}

/** Deep-merge a partial override onto the default configuration. */
export function resolveConfig(override?: DeepPartial<RecommendationConfig>): RecommendationConfig {
  if (!override) return defaultConfig
  return {
    weights: { ...defaultConfig.weights, ...override.weights },
    strategyWeights: {
      ...defaultConfig.strategyWeights,
      ...override.strategyWeights,
    } as Readonly<Record<string, DimensionWeights>>,
    normalization: { ...defaultConfig.normalization, ...override.normalization },
    eligibility: { ...defaultConfig.eligibility, ...override.eligibility },
    reputation: { ...defaultConfig.reputation, ...override.reputation },
    confidence: { ...defaultConfig.confidence, ...override.confidence },
    reasons: { ...defaultConfig.reasons, ...override.reasons },
    governmentKeywords: override.governmentKeywords ?? defaultConfig.governmentKeywords,
    defaultLimit: override.defaultLimit ?? defaultConfig.defaultLimit,
  }
}

/**
 * One-level-deep partial for config overrides. Array-valued fields (e.g.
 * `governmentKeywords`) are kept whole rather than turned into sparse arrays;
 * object-valued fields become shallow-partial.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? Partial<T[K]>
      : T[K]
}
