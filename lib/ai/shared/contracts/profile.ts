/**
 * @module lib/ai/shared/contracts/profile
 *
 * The provenance-aware student profile — a living slot model maintained across
 * the conversation and the mechanism behind "never ask the same question twice"
 * (Reasoning Engine, doc 05 §5).
 */

import type { CareerGoal, Community, RiskAppetite, SlotSource, WeightProfile } from '../enums'
import type { SessionId, UserId } from '../ids'

/**
 * A single profile attribute carrying not just a value but its provenance and
 * trust, so reasoning can weight stated facts over inferred/defaulted ones.
 * @typeParam T The value type of this slot.
 */
export interface Slot<T> {
  /** The slot value. */
  readonly value: T
  /** How the value was obtained (stated / inferred / defaulted). */
  readonly source: SlotSource
  /** Confidence in the value, in the range [0, 1]. */
  readonly confidence: number
  /** ISO-8601 timestamp of the last update. */
  readonly updatedAt: string
  /** Whether a later, higher-trust value may overwrite this one. */
  readonly mutable: boolean
}

/**
 * The set of known student attributes. Each is optional; absence means "unknown"
 * and drives missing-slot detection.
 */
export interface StudentSlots {
  /** The student's rank. */
  readonly rank?: Slot<number>
  /** The student's cutoff mark. */
  readonly cutoff?: Slot<number>
  /** The student's reservation community. */
  readonly community?: Slot<Community>
  /** Preferred district/location. */
  readonly district?: Slot<string>
  /** Budget ceiling (₹/year). */
  readonly budget?: Slot<number>
  /** Preferred branch (free text). */
  readonly preferredBranch?: Slot<string>
  /** Primary career goal. */
  readonly careerGoal?: Slot<CareerGoal>
  /** Whether the student has a research interest. */
  readonly researchInterest?: Slot<boolean>
  /** Whether placement outcomes are a stated priority. */
  readonly placementPriority?: Slot<boolean>
  /** Whether hostel accommodation is required. */
  readonly hostelRequired?: Slot<boolean>
  /** Preferred medium/language, if stated. */
  readonly languagePreference?: Slot<string>
  /** The student's disposition toward admission risk. */
  readonly riskAppetite?: Slot<RiskAppetite>
}

/**
 * The complete, persisted student model for a session. `askedSlots` records
 * every slot the counselor has already requested (answered or not) so it never
 * re-asks (doc 05 §5.3).
 */
export interface StudentProfile {
  /** Owning user id, or `null` for an anonymous session. */
  readonly userId: UserId | null
  /** The session this profile belongs to. */
  readonly sessionId: SessionId
  /** Known attributes. */
  readonly slots: StudentSlots
  /** Slot keys already asked about (the "never ask twice" ledger). */
  readonly askedSlots: readonly string[]
  /** The active recommendation weight profile, if selected. */
  readonly weightProfile: WeightProfile | null
  /** ISO-8601 timestamp of the last profile update. */
  readonly updatedAt: string
}
