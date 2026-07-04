/**
 * Contract & model tests: evidence ranking, the ranker/retriever contracts, and
 * the shapes of RetrievedContext / RetrievalResult produced through the fakes.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_RANKING_STRATEGY, createRetrievalFactory } from '@/lib/ai/retrieval'
import {
  FakeEvidenceRanker,
  FakeKnowledgeRetriever,
  FixedClock,
  makeContext,
  makeEvidence,
  makeStructuredQuery,
} from '@/lib/ai/retrieval/__tests__/support'

describe('EvidenceRanker contract', () => {
  it('orders evidence by descending score', () => {
    const ranker = new FakeEvidenceRanker()
    const ranked = ranker.rank(
      [makeEvidence('college', 0.3), makeEvidence('cutoff', 0.9), makeEvidence('branch', 0.6)],
      DEFAULT_RANKING_STRATEGY,
      makeContext(),
    )
    expect(ranked.map((e) => e.ranking.score)).toEqual([0.9, 0.6, 0.3])
    expect(ranked[0]?.repositoryKind).toBe('cutoff')
  })
})

describe('KnowledgeRetriever contract', () => {
  it('produces a RetrievalResult wrapping a RetrievedContext', async () => {
    const query = makeStructuredQuery('eligibility')
    const request = createRetrievalFactory({ clock: new FixedClock() })
      .newRequestBuilder(query)
      .withRepositories(['cutoff', 'college'])
      .build()

    const result = await new FakeKnowledgeRetriever().retrieve(request, makeContext())

    expect(result.status).toBe('empty')
    expect(result.context.metadata.intent).toBe('eligibility')
    expect(result.context.metadata.kindsSearched).toEqual(['cutoff', 'college'])
    expect(result.statistics.totalEvidence).toBe(0)
    expect(Array.isArray(result.context.evidence)).toBe(true)
  })
})

describe('Evidence model', () => {
  it('attributes evidence to a source and repository kind with a ranking', () => {
    const evidence = makeEvidence('cutoff', 0.75)
    expect(evidence.repositoryKind).toBe('cutoff')
    expect(evidence.sourceId).toBe('src-cutoff')
    expect(evidence.ranking.score).toBe(0.75)
    expect(evidence.record.sourceId).toBe('src-cutoff')
  })
})
