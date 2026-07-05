/**
 * @module lib/ai/runtime/composition-root
 *
 * The single composition root of the AI platform. `createAiApplication` is the
 * ONE place that constructs and wires every dependency; nothing else in the
 * project may instantiate infrastructure directly (Composition Root, doc 07 §9).
 *
 * It is Open/Closed: providers and adapters can be swapped via the `registry`
 * and `overrides` options without changing this function or any business logic.
 */

import { createJsonLogger, createNoopTelemetry, createSystemClock, type LogSink } from '../adapters'
import {
  type AiPlatformConfig,
  createConfigProvider,
  type EnvSource,
  loadAiConfig,
} from '../config'
import {
  createLlmProvider,
  createProviderRegistry,
  createSqlProvider,
  createVectorProvider,
  type ProviderRegistry,
} from '../providers'
import type {
  ClockPort,
  LlmPort,
  LoggerPort,
  SqlPort,
  TelemetryPort,
  VectorIndexPort,
} from '@/lib/ai/shared'
import { type AiContainer, createContainer } from './container'
import type { IdGenerator } from './request-context'

/**
 * Explicit dependency overrides. Any provided value is used verbatim instead of
 * being constructed — the seam for injecting fakes in tests and real adapters
 * from later modules, without touching this file.
 */
export interface AiApplicationOverrides {
  readonly config?: AiPlatformConfig
  readonly logger?: LoggerPort
  readonly clock?: ClockPort
  readonly telemetry?: TelemetryPort
  readonly llm?: LlmPort
  readonly sql?: SqlPort
  readonly vectorIndex?: VectorIndexPort
}

/** Options for booting the AI application. */
export interface AiApplicationOptions {
  /** Environment source for configuration (defaults to `process.env`). */
  readonly env?: EnvSource
  /** Provider registry (defaults to an empty one). */
  readonly registry?: ProviderRegistry
  /** Explicit dependency overrides. */
  readonly overrides?: AiApplicationOverrides
  /** Log output sink (defaults to stdout). */
  readonly logSink?: LogSink
  /** Id generator for request contexts (defaults to crypto UUID). */
  readonly idGenerator?: IdGenerator
}

/** The booted AI application: its container, its config, and a shutdown hook. */
export interface AiApplication {
  /** The dependency container handed to modules. */
  readonly container: AiContainer
  /** The full platform configuration (internal; includes secrets). */
  readonly config: AiPlatformConfig
  /** Gracefully release resources (flush logs/telemetry). */
  shutdown(): Promise<void>
}

/**
 * Boot the AI application: load configuration, construct every adapter and
 * provider, and assemble the container.
 *
 * @param options Environment, provider registry, overrides, and sinks.
 * @throws {@link ConfigError} when configuration is missing/invalid or a selected
 *   provider has no registered adapter.
 */
export function createAiApplication(options: AiApplicationOptions = {}): AiApplication {
  const overrides = options.overrides ?? {}

  // 1. Configuration (fail-fast validation happens here).
  const platform = overrides.config ?? loadAiConfig(options.env)

  // 2. Core infrastructure adapters.
  const clock = overrides.clock ?? createSystemClock()
  const logger =
    overrides.logger ??
    createJsonLogger(
      { level: platform.logging.level, pretty: platform.logging.pretty },
      clock,
      options.logSink,
    )
  // A no-op telemetry adapter today; an OpenTelemetry adapter can be injected via
  // `overrides.telemetry` later without changing any call site.
  const telemetry = overrides.telemetry ?? createNoopTelemetry()

  // 3. Swappable providers, resolved from the registry (or overridden).
  const registry = options.registry ?? createProviderRegistry()
  const providerDeps = { logger: logger.child({ component: 'provider' }), clock }
  const llm = createLlmProvider(platform, providerDeps, registry, overrides.llm)
  const sql = createSqlProvider(platform, providerDeps, registry, overrides.sql)
  const vectorIndex = createVectorProvider(platform, providerDeps, registry, overrides.vectorIndex)

  // 4. Safe config port + container assembly.
  const config = createConfigProvider(platform)
  const container = createContainer({
    config,
    logger,
    clock,
    telemetry,
    llm,
    sql,
    vectorIndex,
    idGenerator: options.idGenerator,
  })

  logger.info({
    message: 'AI application initialized',
    data: {
      llmProvider: platform.llm.provider,
      sqlProvider: platform.supabase.provider,
      vectorProvider: platform.vectorDb.provider,
      flags: platform.flags,
    },
  })

  return Object.freeze({
    container,
    config: platform,
    async shutdown(): Promise<void> {
      logger.info({ message: 'AI application shutting down' })
    },
  })
}
