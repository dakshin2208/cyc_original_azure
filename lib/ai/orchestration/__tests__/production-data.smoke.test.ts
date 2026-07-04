/**
 * @module lib/ai/orchestration/__tests__/production-data.smoke.test
 *
 * OPT-IN integration smoke over the ACTUAL production CSV dataset. Skipped unless
 * `CYC_DATA_DIR` points at the dataset directory, so `npm test` / CI stay
 * hermetic. Verifies that every supported intent produces a valid, deterministic
 * Context Package + Prompt Package over the real 324-college warehouse. No LLM.
 *
 *   CYC_DATA_DIR=/path/to/cyc npx vitest run lib/ai/orchestration/__tests__/production-data.smoke.test.ts
 */

import { existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createAIOrchestrator } from '@/lib/ai/orchestration'

const DIR = process.env.CYC_DATA_DIR

/** One representative question per supported intent. */
const BATTERY: readonly { q: string; intent: string }[] = [
  { q: 'Which is the best engineering college?', intent: 'recommend_college' },
  { q: 'Compare Anna University and PSG College of Technology', intent: 'compare_colleges' },
  { q: 'Which branch should I take, CSE or ECE?', intent: 'branch_advice' },
  { q: 'Which college has the best placements?', intent: 'placement_query' },
  { q: 'Best colleges for research', intent: 'research_query' },
  { q: 'Which college has the best faculty?', intent: 'faculty_query' },
  { q: 'Which college gives the best ROI?', intent: 'roi_query' },
  { q: 'What is the NIRF ranking situation?', intent: 'nirf_query' },
  { q: 'What is the closing cutoff at PSG College of Technology?', intent: 'cutoff_query' },
  { q: 'Can I get into Anna University with 195 cutoff in BC?', intent: 'eligibility_query' },
  { q: 'Tell me about Coimbatore Institute of Technology', intent: 'general_information' },
  { q: 'asdf qwer zxcv', intent: 'unknown' },
]

// Lazy, memoized setup — built only when a test actually runs (never during
// hermetic collection where DIR is unset).
let cached: { repos: ReturnType<typeof createRepositories>; ai: ReturnType<typeof createAIOrchestrator> } | null = null
function setup() {
  if (!cached) {
    const repos = createRepositories(buildWarehouseFromDirectory(DIR as string))
    cached = { repos, ai: createAIOrchestrator(repos, createRetrievalEngine(repos)) }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR))('REAL DATA orchestration smoke', () => {
  it('routes every supported intent to a valid Context + Prompt package', () => {
    const { repos, ai } = setup()
    console.log('══════════════════════════════════════════════════════════════')
    console.log(' AI ORCHESTRATION — REAL PRODUCTION DATA')
    console.log(`ORCHESTRATED over ${repos.colleges.list().length} colleges`)
    console.log('══════════════════════════════════════════════════════════════')

    for (const { q, intent } of BATTERY) {
      const r = ai.orchestrate(q)
      // Intent detection matches expectation.
      expect(r.parsed.intent).toBe(intent)
      // Every run yields a well-formed, non-throwing pipeline result.
      expect(r.prompt.messages.length).toBe(2)
      expect(r.prompt.system.length).toBeGreaterThan(0)
      expect(r.context.intent).toBe(intent)
      expect(['high', 'medium', 'low']).toContain(r.context.confidence.level)

      console.log(
        `[${r.parsed.intent}/${r.parsed.intentConfidence.toFixed(2)}] "${q}"\n` +
          `    subjects=${r.context.subjects.map((c) => c.name).join(' | ') || '—'}\n` +
          `    recs=${r.context.recommendations.length} evidence=${r.context.evidence.count} ` +
          `facts=${r.context.facts.length} missing=${r.context.missingInformation.length} ` +
          `followUps=${r.context.followUpQuestions.length} conf=${r.context.confidence.level}`,
      )
    }
  })

  it('never invents a college — every prompt subject is a real warehouse college', () => {
    const { repos, ai } = setup()
    const known = new Set(repos.colleges.list().map((c) => c.name))
    for (const { q } of BATTERY) {
      const r = ai.orchestrate(q)
      for (const c of r.context.subjects) expect(known.has(c.name)).toBe(true)
      for (const rec of r.context.recommendations) expect(known.has(rec.college.name)).toBe(true)
    }
  })

  it('produces byte-identical prompts across identical runs (determinism)', () => {
    const { ai } = setup()
    const q = 'Compare Anna University and PSG College of Technology'
    const a = JSON.stringify(ai.orchestrate(q).prompt.messages)
    const b = JSON.stringify(ai.orchestrate(q).prompt.messages)
    expect(a).toBe(b)
    console.log(`\n── DETERMINISM: ${a === b ? 'MATCH ✓' : 'DIFFER ✗'}`)
  })

  it('shows a full prompt package for one comparison query', () => {
    const { ai } = setup()
    const r = ai.orchestrate('Compare Anna University and PSG College of Technology')
    console.log('\n────────── SAMPLE PROMPT (system) ──────────')
    console.log(r.prompt.system)
    console.log('\n────────── SAMPLE PROMPT (context) ──────────')
    console.log(r.prompt.context)
    expect(r.prompt.context).toContain('EVIDENCE')
  })
})
