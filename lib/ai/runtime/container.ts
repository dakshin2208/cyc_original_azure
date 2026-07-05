/**
 * @module lib/ai/runtime/container
 *
 * The AI dependency container: the assembled set of injected dependencies that
 * every future module receives. It holds *already-constructed* dependencies and
 * contains **no business logic** — construction is the composition root's job
 * (AI Dependency Container, doc 07 §9).
 */

import type {
  ClockPort,
  ConfigPort,
  LlmPort,
  LoggerPort,
  RequestContext,
  SqlPort,
  TelemetryPort,
  VectorIndexPort,
} from '@/lib/ai/shared'
import {
  createRequestContext,
  type IdGenerator,
  type RequestContextInput,
} from './request-context'

/**
 * The resolved dependency graph handed to business modules. All members are
 * ports (Dependency Inversion): modules depend on these interfaces, never on
 * concrete adapters.
 */
export interface AiContainer {
  /** Safe operational configuration and feature flags. */
  readonly config: ConfigPort
  /** Structured logger. */
  readonly logger: LoggerPort
  /** Time source. */
  readonly clock: ClockPort
  /** Tracing/metrics. */
  readonly telemetry: TelemetryPort
  /** Language-model port. */
  readonly llm: LlmPort
  /** Structured-data port. */
  readonly sql: SqlPort
  /** Vector-store port. */
  readonly vectorIndex: VectorIndexPort
  /** Open a new per-turn {@link RequestContext} using the injected clock. */
  createRequestContext(input: RequestContextInput): RequestContext
}

/** The fully-constructed dependencies used to assemble an {@link AiContainer}. */
export interface ContainerDeps {
  readonly config: ConfigPort
  readonly logger: LoggerPort
  readonly clock: ClockPort
  readonly telemetry: TelemetryPort
  readonly llm: LlmPort
  readonly sql: SqlPort
  readonly vectorIndex: VectorIndexPort
  /** Id generator for request contexts (defaults to crypto UUID). */
  readonly idGenerator?: IdGenerator
}

/**
 * Assemble an immutable {@link AiContainer} from already-constructed
 * dependencies. Called only by the composition root.
 */
export function createContainer(deps: ContainerDeps): AiContainer {
  return Object.freeze({
    config: deps.config,
    logger: deps.logger,
    clock: deps.clock,
    telemetry: deps.telemetry,
    llm: deps.llm,
    sql: deps.sql,
    vectorIndex: deps.vectorIndex,
    createRequestContext(input: RequestContextInput): RequestContext {
      return createRequestContext(input, deps.clock, deps.idGenerator)
    },
  })
}
