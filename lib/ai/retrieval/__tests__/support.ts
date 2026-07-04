/**
 * @module lib/ai/retrieval/__tests__/support
 *
 * Test doubles for the Knowledge Retrieval Layer: a fixed clock, a request
 * context, structured-query and evidence builders, and fakes implementing the
 * retriever contracts (selector, ranker, retriever). Proves the interfaces are
 * coherent; no retrieval logic lives in source. Excluded from build.
 */

import {
  type AuthContext,
  type ClockPort,
  type RequestContext,
  sessionId,
  traceId,
  turnId,
} from '@/lib/ai/shared'
import { createQueryFactory, type QueryIntentType, type StructuredQuery } from '@/lib/ai/query'
import type { KnowledgeRecord, KnowledgeSourceId } from '@/lib/ai/knowledge'
import type {
  EvidenceRanker,
  KnowledgeRetriever,
  RankingStrategy,
  RepositoryKind,
  RepositorySelection,
  RepositorySelector,
  RetrievalRequest,
  RetrievalResult,
  RetrievedEvidence,
} from '@/lib/ai/retrieval'

/** A clock frozen at a fixed instant. */
export class FixedClock implements ClockPort {
  constructor(private readonly iso = '2026-01-01T00:00:00.000Z') {}
  now(): Date {
    return new Date(this.iso)
  }
  isoNow(): string {
    return this.iso
  }
}

/** A minimal, valid request context. */
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

/** Build a structured query with a given intent (reuses the Sprint 4 factory). */
export function makeStructuredQuery(
  intent: QueryIntentType,
  text = 'sample query',
): StructuredQuery {
  return createQueryFactory({ clock: new FixedClock() })
    .newBuilder(text)
    .withIntent({ type: intent, confidence: 0.9, alternatives: [] })
    .build()
}

/** Build a piece of retrieved evidence with a given kind and score. */
export function makeEvidence(kind: RepositoryKind, score: number): RetrievedEvidence {
  const sourceId: KnowledgeSourceId = `src-${kind}`
  const record: KnowledgeRecord = {
    id: `rec-${kind}`,
    sourceId,
    content: {},
    metadata: { confidence: 0.9, language: null, checksum: null, tags: [] },
    retrievedAt: '2026-01-01T00:00:00.000Z',
  }
  return {
    record,
    sourceId,
    repositoryKind: kind,
    ranking: { score, confidence: 0.9, freshness: 0.8, completeness: 0.7, priority: 0.6 },
  }
}

/** A selector mapping intents to repository kinds (mirrors the sprint examples). */
export class FakeRepositorySelector implements RepositorySelector {
  select(query: StructuredQuery, _context: RequestContext): RepositorySelection {
    const byIntent: Partial<Record<QueryIntentType, readonly RepositoryKind[]>> = {
      eligibility: ['cutoff', 'college', 'branch'],
      comparison: ['college', 'statistics'],
      fees: ['fees'],
      recommendation: ['college', 'cutoff', 'branch', 'statistics'],
      information: ['document'],
    }
    const kinds = byIntent[query.intent.type] ?? ['college']
    return { kinds, reason: `selected for intent "${query.intent.type}"` }
  }
}

/** A ranker that orders evidence by descending score (pure, test-only). */
export class FakeEvidenceRanker implements EvidenceRanker {
  rank(
    evidence: readonly RetrievedEvidence[],
    _strategy: RankingStrategy,
    _context: RequestContext,
  ): readonly RetrievedEvidence[] {
    return [...evidence].sort((a, b) => b.ranking.score - a.ranking.score)
  }
}

/** A retriever that returns a fixed, empty result (proves the contract). */
export class FakeKnowledgeRetriever implements KnowledgeRetriever {
  async retrieve(
    request: RetrievalRequest,
    _context: RequestContext,
  ): Promise<RetrievalResult> {
    return {
      context: {
        evidence: [],
        metadata: {
          intent: request.query.intent.type,
          retrievedAt: '2026-01-01T00:00:00.000Z',
          repositoriesSearched: [],
          kindsSearched: request.repositories,
          strategy: request.strategy.kind,
        },
      },
      statistics: { totalEvidence: 0, totalLatencyMs: 0, perSource: [] },
      latencyMs: 0,
      status: 'empty',
    }
  }
}
