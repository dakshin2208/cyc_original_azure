/**
 * @module lib/ai/providers/provider-registry
 *
 * A registry mapping provider names to factory functions for the swappable
 * ports (LLM/SQL/Vector). This is the seam that lets later modules register
 * concrete adapters (Anthropic, Supabase, a vector store) — and lets tests
 * register fakes — **without modifying the composition root or any business
 * logic** (Provider Factory, doc 07 §14; Dependency Inversion).
 */

import type { ClockPort, LlmPort, LoggerPort, SqlPort, VectorIndexPort } from '@/lib/ai/shared'
import type { AiPlatformConfig } from '../config'

/** Infrastructure passed to every provider factory. */
export interface ProviderDeps {
  /** A logger, typically bound to the provider name. */
  readonly logger: LoggerPort
  /** The injected clock. */
  readonly clock: ClockPort
}

/** Builds an {@link LlmPort} from configuration and infrastructure. */
export type LlmProviderFactory = (config: AiPlatformConfig, deps: ProviderDeps) => LlmPort
/** Builds a {@link SqlPort} from configuration and infrastructure. */
export type SqlProviderFactory = (config: AiPlatformConfig, deps: ProviderDeps) => SqlPort
/** Builds a {@link VectorIndexPort} from configuration and infrastructure. */
export type VectorProviderFactory = (config: AiPlatformConfig, deps: ProviderDeps) => VectorIndexPort

/**
 * A mutable registry of provider factories. Populate it before boot (in the
 * composition-root options or by a later module's setup) to make concrete
 * providers available for selection.
 */
export class ProviderRegistry {
  private readonly llm = new Map<string, LlmProviderFactory>()
  private readonly sql = new Map<string, SqlProviderFactory>()
  private readonly vector = new Map<string, VectorProviderFactory>()

  /** Register an LLM provider factory under `name`. */
  registerLlm(name: string, factory: LlmProviderFactory): this {
    this.llm.set(name, factory)
    return this
  }

  /** Register a SQL provider factory under `name`. */
  registerSql(name: string, factory: SqlProviderFactory): this {
    this.sql.set(name, factory)
    return this
  }

  /** Register a vector-store provider factory under `name`. */
  registerVector(name: string, factory: VectorProviderFactory): this {
    this.vector.set(name, factory)
    return this
  }

  /** Resolve a registered LLM factory, or `undefined`. */
  getLlm(name: string): LlmProviderFactory | undefined {
    return this.llm.get(name)
  }

  /** Resolve a registered SQL factory, or `undefined`. */
  getSql(name: string): SqlProviderFactory | undefined {
    return this.sql.get(name)
  }

  /** Resolve a registered vector factory, or `undefined`. */
  getVector(name: string): VectorProviderFactory | undefined {
    return this.vector.get(name)
  }
}

/** Create an empty {@link ProviderRegistry}. */
export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry()
}
