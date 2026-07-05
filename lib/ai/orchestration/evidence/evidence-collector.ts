/**
 * @module lib/ai/orchestration/evidence/evidence-collector
 *
 * EvidenceCollector (Module 4) — gathers every fact returned by the
 * Recommendation, Comparison, and Retrieval engines into one set, then
 * deduplicates, ranks, assigns confidence, and attaches source metadata. Pure
 * and deterministic — it copies engine output; it never re-derives or invents.
 */

import { slugify } from '@/lib/knowledge'
import type { ComparisonResult, RecommendationResult } from '@/lib/recommendation'
import { bandOf, confidenceForStrength, type OrchestrationConfig } from '../config'
import type { EvidenceItem, EvidencePackage, EvidenceSource, RetrievedFact } from '../models'

/** The raw engine outputs to collect evidence from. */
export interface EvidenceInput {
  readonly recommendations: readonly RecommendationResult[]
  readonly comparison: ComparisonResult | null
  readonly facts: readonly RetrievedFact[]
}

/** The EvidenceCollector component. */
export interface EvidenceCollector {
  collect(input: EvidenceInput): EvidencePackage
}

const EMPTY_BY_SOURCE: Readonly<Record<EvidenceSource, number>> = {
  recommendation: 0,
  comparison: 0,
  retrieval: 0,
  warehouse: 0,
}

/** Create the evidence collector bound to a resolved config. */
export function createEvidenceCollector(config: OrchestrationConfig): EvidenceCollector {
  const idFor = (parts: readonly (string | number | null)[]): string =>
    slugify(parts.map((p) => (p === null ? '-' : String(p))).join(' '))

  const collect = (input: EvidenceInput): EvidencePackage => {
    const raw: EvidenceItem[] = []

    // ── Recommendation evidence (from structured reasons) ─────────────────────
    for (const rec of input.recommendations) {
      for (const reason of rec.explanation.reasons) {
        const confidence = confidenceForStrength(reason.strength, config.evidenceConfidence)
        for (const e of reason.evidence) {
          raw.push({
            id: idFor(['recommendation', rec.college.name, e.dimension, e.label, e.value]),
            collegeName: rec.college.name,
            dimension: e.dimension,
            label: e.label,
            value: e.value,
            source: 'recommendation',
            origin: e.source,
            confidence,
            confidenceLevel: bandOf(confidence, config.confidenceBands),
          })
        }
      }
    }

    // ── Comparison evidence (overall + per-dimension winners) ─────────────────
    if (input.comparison) {
      const cmp = input.comparison
      const cScore = config.evidenceConfidence.comparison
      if (cmp.winner) {
        raw.push({
          id: idFor(['comparison', cmp.winner.name, 'overall', 'winner']),
          collegeName: cmp.winner.name,
          dimension: null,
          label: 'Overall comparison winner',
          value: cmp.winner.name,
          source: 'comparison',
          origin: 'comparison',
          confidence: cScore,
          confidenceLevel: bandOf(cScore, config.confidenceBands),
        })
      }
      for (const d of cmp.dimensions) {
        if (!d.winner) continue
        raw.push({
          id: idFor(['comparison', d.winner.name, d.dimension, 'winner']),
          collegeName: d.winner.name,
          dimension: d.dimension,
          label: `Best on ${d.dimension}`,
          value: d.winner.name,
          source: 'comparison',
          origin: 'comparison',
          confidence: cScore,
          confidenceLevel: bandOf(cScore, config.confidenceBands),
        })
      }
    }

    // ── Retrieved facts (concrete warehouse values) ───────────────────────────
    for (const fact of input.facts) {
      const confidence =
        fact.value === null ? config.evidenceConfidence.factMissing : config.evidenceConfidence.fact
      raw.push({
        id: idFor(['retrieval', fact.collegeName, fact.origin, fact.label, fact.value]),
        collegeName: fact.collegeName,
        dimension: null,
        label: fact.label,
        value: fact.value,
        source: 'retrieval',
        origin: fact.origin,
        confidence,
        confidenceLevel: bandOf(confidence, config.confidenceBands),
      })
    }

    // ── Deduplicate (keep the highest-confidence copy of each id) ─────────────
    const byId = new Map<string, EvidenceItem>()
    for (const item of raw) {
      const existing = byId.get(item.id)
      if (!existing || item.confidence > existing.confidence) byId.set(item.id, item)
    }

    // ── Rank: value-bearing first, then confidence, source, college, label ────
    const items = [...byId.values()].sort((a, b) => {
      const av = a.value === null ? 0 : 1
      const bv = b.value === null ? 0 : 1
      if (av !== bv) return bv - av
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      const sr = config.sourceRank[b.source] - config.sourceRank[a.source]
      if (sr !== 0) return sr
      return (a.collegeName ?? '').localeCompare(b.collegeName ?? '') || a.label.localeCompare(b.label)
    })

    const bySource = { ...EMPTY_BY_SOURCE }
    for (const item of items) bySource[item.source] += 1

    return { items, count: items.length, bySource }
  }

  return Object.freeze({ collect })
}
