/**
 * @module lib/opinion/__tests__/production-data.smoke.test
 *
 * OPT-IN opinion smoke over the ACTUAL production warehouse. Skipped unless
 * `CYC_DATA_DIR` is set. Verifies the counselor produces grounded, deterministic
 * recommendations for the example queries over the real 324-college dataset,
 * never inventing a college. No LLM.
 *
 *   CYC_DATA_DIR=/path/to/cyc npx vitest run lib/opinion/__tests__/production-data.smoke.test.ts
 */

import { existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createOpinionService } from '@/lib/opinion'

const DIR = process.env.CYC_DATA_DIR

const QUERIES: readonly { q: string; strategy: string }[] = [
  { q: 'I scored 182. Which colleges should I choose?', strategy: 'eligibility_bands' },
  { q: 'Which is better for CSE: PSG College of Technology or Coimbatore Institute of Technology?', strategy: 'comparison' },
  { q: 'I belong to BC and have 165 cutoff.', strategy: 'eligibility_bands' },
  { q: 'best colleges for research', strategy: 'research_focused' },
  { q: 'which college gives the best ROI?', strategy: 'budget_focused' },
  { q: 'asdfghjkl', strategy: 'insufficient_evidence' },
]

let cached: { known: Set<string>; svc: ReturnType<typeof createOpinionService> } | null = null
function setup() {
  if (!cached) {
    const repos = createRepositories(buildWarehouseFromDirectory(DIR as string))
    cached = { known: new Set(repos.colleges.list().map((c) => c.name)), svc: createOpinionService(repos, createRetrievalEngine(repos)) }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR))('REAL DATA opinion smoke', () => {
  it('counsels on every example query without inventing a college', async () => {
    const { known, svc } = setup()
    console.log('══════ OPINION ENGINE — REAL PRODUCTION DATA ══════')
    for (const { q, strategy } of QUERIES) {
      const { response } = await svc.advise(q)
      expect(response.strategy).toBe(strategy)
      expect(response.answer.length).toBeGreaterThan(0)
      // Every recommended college is a real warehouse college.
      for (const item of response.recommendationSummary) {
        for (const name of item.colleges) expect(known.has(name)).toBe(true)
      }
      // Every cited college is real too (no fabricated citations).
      for (const c of response.evidence) {
        if (c.collegeName) expect(known.has(c.collegeName)).toBe(true)
      }
      console.log(`[${response.strategy}] "${q}" → ${response.recommendationSummary.map((s) => `${s.kind}:${s.colleges.slice(0, 2).join('/')}`).join(' | ') || 'clarify'}`)
    }
  })

  it('is deterministic', async () => {
    const { svc } = setup()
    const q = 'best colleges for research'
    const a = JSON.stringify((await svc.advise(q)).response.recommendationSummary)
    const b = JSON.stringify((await svc.advise(q)).response.recommendationSummary)
    expect(a).toBe(b)
  })
})
