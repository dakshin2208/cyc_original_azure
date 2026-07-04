/**
 * @module lib/ai/shared/contracts/plan
 *
 * The execution plan produced by the Planner and the short-circuit directives it
 * may emit instead (Reasoning Engine, doc 05 §6). A plan is a dependency-ordered
 * list of engine steps; a directive ends the turn early (ask or abstain).
 */

import type { AbstentionReason, EngineName, ReasoningMode } from '../enums'

/** One step of an execution plan: invoke an engine in a given reasoning mode. */
export interface PlanStep {
  /** Stable id for this step (referenced by `dependsOn`). */
  readonly id: string
  /** The engine to invoke. */
  readonly engine: EngineName
  /** The reasoning mode this step serves. */
  readonly mode: ReasoningMode
  /** Ids of steps that must complete before this one. */
  readonly dependsOn: readonly string[]
  /** Engine-specific parameters (opaque to the Planner contract). */
  readonly params: Readonly<Record<string, unknown>>
}

/**
 * A concrete plan: the reasoning modes in play, the ordered steps, and the keys
 * of evidence the Reasoning module must have before deciding.
 */
export interface ExecutionPlan {
  /** Discriminator for the {@link PlanOutcome} union. */
  readonly kind: 'plan'
  /** Reasoning modes covered by this plan. */
  readonly modes: readonly ReasoningMode[]
  /** Dependency-ordered engine steps. */
  readonly steps: readonly PlanStep[]
  /** Evidence keys required to reach a decision. */
  readonly evidenceContract: readonly string[]
}

/** A directive to pause and ask the student for missing information. */
export interface ClarifyDirective {
  /** Discriminator for the {@link PlanOutcome} union. */
  readonly kind: 'clarify'
  /** Slot keys that are missing and could not be inferred. */
  readonly missingSlots: readonly string[]
  /** A single, targeted question to ask. */
  readonly question: string
}

/** A directive to decline the turn (a principled, honest non-answer). */
export interface AbstainDirective {
  /** Discriminator for the {@link PlanOutcome} union. */
  readonly kind: 'abstain'
  /** Why the counselor is abstaining. */
  readonly reason: AbstentionReason
  /** A user-facing explanation. */
  readonly message: string
}

/**
 * The Planner's output: either a runnable {@link ExecutionPlan} or an early
 * termination ({@link ClarifyDirective} or {@link AbstainDirective}).
 */
export type PlanOutcome = ExecutionPlan | ClarifyDirective | AbstainDirective
