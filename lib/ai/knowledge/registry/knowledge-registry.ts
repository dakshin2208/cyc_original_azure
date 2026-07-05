/**
 * @module lib/ai/knowledge/registry/knowledge-registry
 *
 * The Knowledge Registry: the catalog of registered sources and the resolver
 * that turns a source id into a live {@link KnowledgeRepository}. New sources
 * plug in via {@link KnowledgeRegistry.register} without any existing code
 * changing (Open/Closed).
 *
 * Repositories are built lazily on first resolution — via the injected
 * {@link RepositoryFactory}, which supplies dependencies — and then memoized.
 * Health rollup is a pure reducer over each source's self-reported status; no
 * active monitoring (polling/scheduling/alerting) is implemented here.
 */

import type { ClockPort, RequestContext } from '@/lib/ai/shared'
import {
  type KnowledgeRepository,
  type KnowledgeSource,
  type KnowledgeSourceId,
  SourceAlreadyRegisteredError,
  SourceNotFoundError,
} from '../contracts'
import type { HealthReport, HealthStatus, SourceHealth } from '../health'
import type { RepositoryBuilder, RepositoryFactory } from '../repositories'

/** The public registry contract. */
export interface KnowledgeRegistry {
  /**
   * Register a source and how to build its repository.
   * @throws {@link SourceAlreadyRegisteredError} when the id is already registered.
   */
  register<R extends KnowledgeRepository>(source: KnowledgeSource, builder: RepositoryBuilder<R>): void

  /** Whether a source id is registered. */
  has(id: KnowledgeSourceId): boolean

  /**
   * Resolve a source id to its (lazily built, memoized) repository.
   * @throws {@link SourceNotFoundError} when the id is not registered.
   */
  resolve(id: KnowledgeSourceId): KnowledgeRepository

  /**
   * Resolve to a specifically-typed repository (e.g. `SqlRepository`).
   * @throws {@link SourceNotFoundError} when the id is not registered.
   */
  resolveTyped<R extends KnowledgeRepository>(id: KnowledgeSourceId): R

  /** List all registered source descriptors. */
  list(): readonly KnowledgeSource[]

  /** Produce an aggregate health report across all registered sources. */
  health(context: RequestContext): Promise<HealthReport>
}

/** Internal registry entry: a source, its builder, and the memoized instance. */
interface RegistryEntry {
  readonly source: KnowledgeSource
  readonly builder: RepositoryBuilder
  instance: KnowledgeRepository | null
}

/** Severity ordering used to compute the overall health rollup. */
const SEVERITY: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  unknown: 1,
  initializing: 2,
  degraded: 3,
  unavailable: 4,
}

/** Reduce many source statuses to the single worst (highest-severity) status. */
function rollup(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, current) => (SEVERITY[current] > SEVERITY[worst] ? current : worst),
    'unknown',
  )
}

/**
 * Create a {@link KnowledgeRegistry}.
 *
 * @param factory Builds repositories with injected dependencies.
 * @param clock   Time source for the aggregate report timestamp.
 */
export function createKnowledgeRegistry(
  factory: RepositoryFactory,
  clock: ClockPort,
): KnowledgeRegistry {
  const entries = new Map<KnowledgeSourceId, RegistryEntry>()

  function resolveEntry(id: KnowledgeSourceId): RegistryEntry {
    const entry = entries.get(id)
    if (!entry) throw new SourceNotFoundError(id)
    if (!entry.instance) entry.instance = factory.build(entry.builder)
    return entry
  }

  return Object.freeze({
    register<R extends KnowledgeRepository>(
      source: KnowledgeSource,
      builder: RepositoryBuilder<R>,
    ): void {
      if (entries.has(source.id)) throw new SourceAlreadyRegisteredError(source.id)
      entries.set(source.id, { source, builder, instance: null })
    },

    has(id: KnowledgeSourceId): boolean {
      return entries.has(id)
    },

    resolve(id: KnowledgeSourceId): KnowledgeRepository {
      return resolveEntry(id).instance as KnowledgeRepository
    },

    resolveTyped<R extends KnowledgeRepository>(id: KnowledgeSourceId): R {
      return resolveEntry(id).instance as unknown as R
    },

    list(): readonly KnowledgeSource[] {
      return [...entries.values()].map((entry) => entry.source)
    },

    async health(context: RequestContext): Promise<HealthReport> {
      const sources: SourceHealth[] = await Promise.all(
        [...entries.keys()].map((id) => resolveEntry(id).instance!.health(context)),
      )
      return {
        overall: rollup(sources.map((s) => s.status)),
        sources,
        generatedAt: clock.isoNow(),
      }
    },
  })
}
