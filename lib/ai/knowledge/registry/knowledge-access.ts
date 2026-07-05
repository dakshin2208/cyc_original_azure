/**
 * @module lib/ai/knowledge/registry/knowledge-access
 *
 * The composition entry point for the Knowledge Access Layer. `createKnowledgeAccess`
 * wires the {@link RepositoryFactory} and {@link KnowledgeRegistry} from injected
 * dependencies and returns the facade the rest of the platform uses.
 *
 * This is where the layer connects to the Sprint 2 runtime container: a caller
 * passes `{ logger, clock, telemetry }` from `AiContainer`. The Knowledge Access
 * Layer never constructs infrastructure itself.
 */

import type { KnowledgeDependencies } from '../contracts'
import { createRepositoryFactory } from '../repositories'
import { createKnowledgeRegistry, type KnowledgeRegistry } from './knowledge-registry'

/** The facade exposed to the platform for all knowledge access. */
export interface KnowledgeAccess {
  /** The source registry (register / resolve / list / health). */
  readonly registry: KnowledgeRegistry
}

/**
 * Build the Knowledge Access Layer from injected dependencies.
 *
 * @param dependencies Infrastructure from the runtime container.
 */
export function createKnowledgeAccess(dependencies: KnowledgeDependencies): KnowledgeAccess {
  const factory = createRepositoryFactory(dependencies)
  const registry = createKnowledgeRegistry(factory, dependencies.clock)
  return Object.freeze({ registry })
}
