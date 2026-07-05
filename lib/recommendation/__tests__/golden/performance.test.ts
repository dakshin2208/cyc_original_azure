/**
 * @module lib/recommendation/__tests__/golden/performance.test
 *
 * Phase 6 — in-process performance & reliability of the recommendation engine (the
 * deterministic core of recommendation response time). Measures warehouse build cost,
 * per-recommendation latency (p50/p95/p99/max over 1000 calls across the scenario
 * matrix), and heap footprint, and asserts generous ceilings to catch pathological
 * regressions. HTTP/concurrent/DB/Azure load testing requires a running server + staging
 * environment and is out of scope for this in-process harness (see the readiness report).
 * Gated on the real warehouse.
 */

import { existsSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup, createRecommendationEngine } from '@/lib/recommendation'
import { VALIDATION_SCENARIOS } from './validation-scenarios'

const DIR = process.env.CYC_DATA_DIR

describe.skipIf(!DIR || !existsSync(DIR as string))('performance & reliability (in-process)', () => {
  it('measures build cost, recommendation latency, and heap footprint', () => {
    const t0 = performance.now()
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const retrieval = createRetrievalEngine(repos)
    const reco = createRecommendationEngine(repos, retrieval, { cutoffs: createCommunityCutoffLookup(repos) })
    const buildMs = performance.now() - t0

    // Warm the profile cache, then measure steady-state latency across the matrix.
    for (const s of VALIDATION_SCENARIOS.slice(0, 20)) reco.recommend(s.request)
    const N = 1000
    const lat: number[] = []
    for (let i = 0; i < N; i += 1) {
      const s = VALIDATION_SCENARIOS[i % VALIDATION_SCENARIOS.length]
      const t = performance.now()
      reco.recommend(s.request)
      lat.push(performance.now() - t)
    }
    lat.sort((a, b) => a - b)
    const q = (p: number): number => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]
    const mean = lat.reduce((a, b) => a + b, 0) / lat.length
    const mem = process.memoryUsage()
    const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(0)} MB`

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '════════ PERFORMANCE REPORT (in-process engine) ════════',
        `Colleges in warehouse: ${repos.colleges.list().length}`,
        `Warehouse build (cold): ${buildMs.toFixed(0)} ms  (one-time, cached per process)`,
        `Recommendation latency over ${N} calls:`,
        `  mean ${mean.toFixed(3)} ms | p50 ${q(0.5).toFixed(3)} ms | p95 ${q(0.95).toFixed(3)} ms | p99 ${q(0.99).toFixed(3)} ms | max ${q(1).toFixed(3)} ms`,
        `Heap after build: heapUsed ${mb(mem.heapUsed)} | rss ${mb(mem.rss)}`,
        '════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )

    // Generous ceilings — regression tripwires, not tight SLOs (machine-dependent).
    expect(buildMs).toBeLessThan(60000)
    expect(q(0.95)).toBeLessThan(100)
    expect(repos.colleges.list().length).toBeGreaterThan(0)
  })

  it('is stable under repeated load (no drift across 200 identical calls)', () => {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos), {
      cutoffs: createCommunityCutoffLookup(repos),
    })
    const req = VALIDATION_SCENARIOS.find((s) => s.group === 'high')?.request ?? VALIDATION_SCENARIOS[0].request
    const first = reco.recommend(req).map((r) => r.college.id)
    for (let i = 0; i < 200; i += 1) {
      expect(reco.recommend(req).map((r) => r.college.id)).toEqual(first)
    }
  })
})
