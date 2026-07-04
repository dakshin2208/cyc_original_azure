/**
 * @module lib/ai/orchestration/__tests__/evidence-collector.test
 * EvidenceCollector — dedupe, rank, confidence, source metadata.
 */

import { describe, expect, it } from 'vitest'
import {
  createEvidenceCollector,
  defaultOrchestrationConfig,
  type RetrievedFact,
} from '@/lib/ai/orchestration'
import { makeHarness, NAME } from './support'

const { ai } = makeHarness()
const collector = createEvidenceCollector(defaultOrchestrationConfig)

describe('evidence collector', () => {
  it('collects and ranks evidence from recommendation reasons', () => {
    const recommendations = ai.reco.recommendBestCollege({ limit: 3 })
    const pkg = collector.collect({ recommendations, comparison: null, facts: [] })
    expect(pkg.count).toBeGreaterThan(0)
    expect(pkg.bySource.recommendation).toBe(pkg.count)
    for (const item of pkg.items) {
      expect(item.source).toBe('recommendation')
      expect(item.confidence).toBeGreaterThanOrEqual(0)
      expect(item.confidence).toBeLessThanOrEqual(1)
      expect(['high', 'medium', 'low']).toContain(item.confidenceLevel)
    }
  })

  it('assigns unique ids and deduplicates', () => {
    const recommendations = ai.reco.recommendBestCollege({ limit: 3 })
    const pkg = collector.collect({ recommendations, comparison: null, facts: [] })
    const ids = pkg.items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ranks value-bearing evidence above unavailable evidence', () => {
    const facts: RetrievedFact[] = [
      { collegeName: NAME.psg, label: 'Closing cutoff', value: null, origin: 'cutoff' },
      { collegeName: NAME.psg, label: 'Median salary (INR/yr)', value: 900000, origin: 'placement' },
    ]
    const pkg = collector.collect({ recommendations: [], comparison: null, facts })
    expect(pkg.items[0].value).toBe(900000) // value-bearing first
    const missing = pkg.items.find((i) => i.label === 'Closing cutoff')!
    expect(missing.confidence).toBe(defaultOrchestrationConfig.evidenceConfidence.factMissing)
    expect(missing.confidenceLevel).toBe('low')
    expect(pkg.bySource.retrieval).toBe(2)
  })

  it('collects comparison winners with source metadata', () => {
    const cmp = ai.reco.compareColleges([NAME.psg, NAME.anna])
    const pkg = collector.collect({ recommendations: [], comparison: cmp, facts: [] })
    expect(pkg.count).toBeGreaterThan(0)
    expect(pkg.bySource.comparison).toBe(pkg.count)
    expect(pkg.items.some((i) => i.label === 'Overall comparison winner')).toBe(true)
  })

  it('is deterministic', () => {
    const recommendations = ai.reco.recommendBestCollege({ limit: 3 })
    const a = collector.collect({ recommendations, comparison: null, facts: [] })
    const b = collector.collect({ recommendations, comparison: null, facts: [] })
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id))
  })
})
