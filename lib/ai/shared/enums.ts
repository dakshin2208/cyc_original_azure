/**
 * @module lib/ai/shared/enums
 *
 * Cross-cutting domain enumerations for the AI College Counselor.
 *
 * Style: the codebase models closed sets as string-literal unions (see
 * `TrendDirection`, `PlanType`, `ApiSection`) rather than TypeScript `enum`.
 * We follow that convention and additionally expose a frozen `*_VALUES` array
 * as the single source of truth, deriving the union type from it. This gives
 * both a compile-time union and a runtime-iterable list without drift.
 *
 * These enums are consumed by every downstream AI module (Intent, Planner,
 * Reasoning, all engines) and are therefore intentionally dependency-free.
 */

/** Discriminated question categories (Question Audit, doc 02 §1). */
export const INTENT_CATEGORIES = [
  'prediction',
  'recommendation',
  'comparison',
  'knowledge',
  'roi',
  'exploration',
  'process',
  'faq',
  'personalized',
  'out_of_scope',
] as const
/** A top-level user question category. */
export type IntentCategory = (typeof INTENT_CATEGORIES)[number]

/** Reasoning strategies the Planner can select (Reasoning Engine, doc 05 §4). */
export const REASONING_MODES = [
  'eligibility',
  'recommendation',
  'comparison',
  'trade_off',
  'constraint',
  'goal_based',
  'multi_step',
  'clarification',
  'what_if',
  'definitional',
  'abstention',
] as const
/** A single reasoning strategy. */
export type ReasoningMode = (typeof REASONING_MODES)[number]

/** Which retrieval surface a turn requires (AI Architecture, doc 03 §16). */
export const DATA_NEEDS = ['sql', 'rag', 'both', 'none'] as const
/** The retrieval surface(s) needed to answer a turn. */
export type DataNeed = (typeof DATA_NEEDS)[number]

/** Admission risk classification for an eligible option (Prediction, doc 03 §8). */
export const RISK_TIERS = ['safe', 'target', 'reach'] as const
/** How likely a student is to secure a given seat. */
export type RiskTier = (typeof RISK_TIERS)[number]

/** Provenance of a student-profile slot value (Reasoning Engine, doc 05 §5.1). */
export const SLOT_SOURCES = ['stated', 'inferred', 'defaulted'] as const
/** Where a profile slot value came from — governs trust and overridability. */
export type SlotSource = (typeof SLOT_SOURCES)[number]

/** TNEA reservation communities (Knowledge Audit, doc 01 — Cutoff/Rank columns). */
export const COMMUNITIES = [
  'OC',
  'BC',
  'BCM',
  'MBC',
  'MBCDNC',
  'MBCV',
  'SC',
  'SCA',
  'ST',
] as const
/** A Tamil Nadu engineering-admissions reservation community. */
export type Community = (typeof COMMUNITIES)[number]

/** Student disposition toward admission risk (Recommendation Engine, doc 04 §7). */
export const RISK_APPETITES = ['conservative', 'balanced', 'aggressive'] as const
/** How much admission risk the student is willing to take. */
export type RiskAppetite = (typeof RISK_APPETITES)[number]

/** High-level student objective used to select a weight profile (doc 04 §7). */
export const CAREER_GOALS = [
  'placement',
  'research',
  'higher_studies',
  'core_engineering',
  'undecided',
] as const
/** The student's primary goal, used to bias recommendations. */
export type CareerGoal = (typeof CAREER_GOALS)[number]

/** Recommendation weighting presets (Recommendation Engine, doc 04 §7). */
export const WEIGHT_PROFILES = [
  'balanced',
  'placement_focused',
  'research_focused',
  'reputation_focused',
  'proximity_focused',
  'safety_focused',
] as const
/** A named set of factor weights applied during ranking. */
export type WeightProfile = (typeof WEIGHT_PROFILES)[number]

/** Prediction input mode (Prediction Engine, doc 03 §8). */
export const PREDICTION_MODES = ['cutoff', 'rank'] as const
/** Whether prediction is driven by a cutoff mark or a rank. */
export type PredictionMode = (typeof PREDICTION_MODES)[number]

/** Coarse confidence banding surfaced to users (Reasoning Engine, doc 05 §8). */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const
/** A human-facing confidence band derived from a numeric score. */
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

/**
 * Known knowledge gaps in the data estate (Knowledge/Question Audits, docs 01–02).
 * Used to disclose — never hide — what a decision could not consider.
 */
export const GAP_TOKENS = [
  'FEES',
  'CALENDAR',
  'SEAT_MATRIX',
  'GEO',
  'RECRUITERS',
  'BRANCH_NIRF',
  'YEAR_AT_L1',
  'SCORE_DEF',
  'NIRF_RANK',
] as const
/** A named, structural gap in the available knowledge. */
export type GapToken = (typeof GAP_TOKENS)[number]

/** Reasons the counselor may decline to answer (Reasoning Engine, doc 05 §10). */
export const ABSTENTION_REASONS = [
  'missing_data',
  'conflicting_evidence',
  'ambiguous_question',
  'entity_not_found',
  'no_eligible_option',
  'insufficient_evidence',
  'out_of_scope',
] as const
/** Why a turn terminated without a substantive answer. */
export type AbstentionReason = (typeof ABSTENTION_REASONS)[number]

/** Kinds of evidence conflict detected during validation (doc 05 §3, stage ⑧). */
export const CONFLICT_KINDS = ['value_mismatch', 'stale_vs_fresh', 'source_disagreement'] as const
/** The nature of a disagreement between two pieces of evidence. */
export type ConflictKind = (typeof CONFLICT_KINDS)[number]

/** Domain engines the Planner can dispatch to (Implementation Modules, doc 06). */
export const ENGINE_NAMES = [
  'prediction',
  'recommendation',
  'comparison',
  'knowledge',
  'retrieval',
] as const
/** The name of a domain engine referenced by an execution plan. */
export type EngineName = (typeof ENGINE_NAMES)[number]
