/**
 * @module lib/ai/knowledge/__tests__/support
 *
 * Test doubles for the Knowledge Access Layer: a configurable fake repository,
 * a dependency bundle built from the real Sprint 2 adapters, and small builders
 * for sources and request contexts. Excluded from the production build.
 */

import {
  type AuthContext,
  ok,
  type RequestContext,
  sessionId,
  traceId,
  turnId,
} from '@/lib/ai/shared'
import { createJsonLogger, createNoopTelemetry, createSystemClock } from '@/lib/ai/adapters'
import type {
  KnowledgeDependencies,
  KnowledgeRecord,
  KnowledgeRepository,
  KnowledgeResult,
  KnowledgeSource,
  KnowledgeSourceId,
  KnowledgeSourceType,
  RepositoryResult,
} from '@/lib/ai/knowledge'
import type { HealthStatus, SourceHealth } from '@/lib/ai/knowledge'

/** Build a dependency bundle from the real infrastructure adapters. */
export function makeDeps(): KnowledgeDependencies {
  const clock = createSystemClock()
  return {
    clock,
    telemetry: createNoopTelemetry(),
    logger: createJsonLogger({ level: 'error', pretty: false }, clock, () => {}),
  }
}

/** Build a minimal, valid request context for repository calls. */
export function makeContext(): RequestContext {
  const auth: AuthContext = { userId: null, isAuthenticated: false, plan: 'freemium', roles: [] }
  return {
    userId: null,
    sessionId: sessionId('sess-test'),
    turnId: turnId('turn-test'),
    traceId: traceId('trace-test'),
    auth,
    startedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Build a source descriptor for tests. */
export function makeSource(
  id: string,
  type: KnowledgeSourceType = 'sql',
): KnowledgeSource {
  const sourceId = id as KnowledgeSourceId
  return {
    id: sourceId,
    type,
    name: `source ${id}`,
    description: `test source ${id}`,
    metadata: {
      sourceId,
      sourceType: type,
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      checksum: null,
      owner: null,
      schema: null,
      confidence: null,
      language: null,
      sizeBytes: null,
    },
  }
}

/** A configurable fake repository that reports a fixed health status. */
export class FakeRepository implements KnowledgeRepository {
  constructor(
    readonly source: KnowledgeSource,
    private readonly status: HealthStatus,
    readonly deps: KnowledgeDependencies,
  ) {}

  async get(): Promise<RepositoryResult<KnowledgeRecord | null>> {
    return ok(null)
  }

  async query(): Promise<RepositoryResult<KnowledgeResult>> {
    return ok({
      records: [],
      total: 0,
      sourceId: this.source.id,
      retrievedAt: '2026-01-01T00:00:00.000Z',
      truncated: false,
    })
  }

  async health(): Promise<SourceHealth> {
    return {
      sourceId: this.source.id,
      status: this.status,
      checkedAt: '2026-01-01T00:00:00.000Z',
      message: null,
      latencyMs: null,
      details: null,
    }
  }
}
