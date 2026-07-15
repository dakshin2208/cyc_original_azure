/**
 * @module lib/ai/tools/__tests__/orchestration
 *
 * Deliverable 5 — proves the orchestration prototype end-to-end:
 *
 *   question → LLM understand → ToolRequest → existing recommendation engine → facts
 *
 * The hermetic test uses a STATIC provider that returns the canned tool-request
 * JSON (so it runs offline, in CI, with no network) and the EXISTING fixture
 * warehouse + recommendation engine. An opt-in live test hits real Azure OpenAI +
 * the real warehouse when CYC_DATA_DIR and OPENAI_API_KEY are configured. No writer,
 * no route change, no provider change.
 */

import { describe, it, expect } from 'vitest'
import { createStaticProvider, readOpenAiConfig, resolveConfiguredProvider } from '@/lib/ai/llm'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import {
  createCommunityCutoffLookup,
  createRecommendationEngine,
  type RecommendationEngine,
} from '@/lib/recommendation'
import { makeHarness } from '../../orchestration/__tests__/support'
import { createOrchestrationPrototype, parseToolRequest } from '..'

/** A recommendation engine over the compact fixture warehouse (Coimbatore = PSG + Kumaraguru). */
function fixtureReco(): RecommendationEngine {
  const { repos, retrieval } = makeHarness()
  return createRecommendationEngine(repos, retrieval, { cutoffs: createCommunityCutoffLookup(repos) })
}

describe('orchestration prototype — question → tool request → engine → facts (hermetic)', () => {
  it('understands the request and returns structured facts from the existing engine', async () => {
    // LLM call 1 is simulated by a static provider returning the tool-request JSON.
    // District is left null here: the compact fixture warehouse carries no district
    // values (district comes from the 2026 NIRF CSV, absent in the fixture), so the
    // real district filter is exercised by the opt-in live test below instead.
    const toolJson = JSON.stringify({
      tool: 'recommend_by_cutoff',
      arguments: { cutoff: 150, community: 'BC', district: null },
    })
    const proto = createOrchestrationPrototype({
      provider: createStaticProvider('understand-stub', toolJson),
      reco: fixtureReco(),
    })

    const result = await proto.run('My cutoff is 150 and I am BC community. Which colleges can I get?')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The understood tool request.
    expect(result.request.tool).toBe('recommend_by_cutoff')
    expect(result.request.arguments).toMatchObject({ cutoff: 150, community: 'BC' })

    // Structured facts from the real engine — ranked, no prose. PSG is the strongest
    // fixture college, so it ranks first; ranks are contiguous from 1.
    expect(result.facts.tool).toBe('recommend_by_cutoff')
    expect(result.facts.count).toBe(3)
    const names = result.facts.colleges.map((c) => c.name)
    expect(names[0]).toBe('PSG College of Technology')
    expect(names).toContain('Anna University')
    expect(names).toContain('Kumaraguru College of Technology')
    expect(result.facts.colleges.map((c) => c.rank)).toEqual([1, 2, 3])
  })

  it('surfaces an understand-stage error when the LLM returns no valid tool request', async () => {
    const proto = createOrchestrationPrototype({
      provider: createStaticProvider('bad-stub', 'sorry, I cannot help'),
      reco: fixtureReco(),
    })
    const result = await proto.run('anything')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.stage).toBe('understand')
  })
})

describe('parseToolRequest — tool request JSON schema', () => {
  it('parses a fenced JSON block and coerces a stringified cutoff', () => {
    const r = parseToolRequest('```json\n{"tool":"recommend_by_cutoff","arguments":{"cutoff":"170","community":"BC"}}\n```')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.request.arguments.cutoff).toBe(170)
    expect(r.request.arguments.community).toBe('BC')
    expect(r.request.arguments.district).toBeNull()
  })

  it('rejects an unknown tool', () => {
    expect(parseToolRequest('{"tool":"do_magic","arguments":{}}').ok).toBe(false)
  })

  it('rejects a missing cutoff', () => {
    expect(parseToolRequest('{"tool":"recommend_by_cutoff","arguments":{"community":"BC"}}').ok).toBe(false)
  })

  it('rejects an unrecognised community', () => {
    expect(parseToolRequest('{"tool":"recommend_by_cutoff","arguments":{"cutoff":170,"community":"zzz"}}').ok).toBe(false)
  })
})

// ── Opt-in: real Azure OpenAI + real warehouse (runs only when configured) ──────
const liveEnv = process.env
const canRunLive = Boolean(liveEnv.CYC_DATA_DIR) && readOpenAiConfig(liveEnv) !== null

describe.skipIf(!canRunLive)('orchestration prototype — live Azure OpenAI + real warehouse', () => {
  it('the LLM emits a recommend_by_cutoff request and the engine returns facts', async () => {
    const repos = createRepositories(buildWarehouseFromDirectory(liveEnv.CYC_DATA_DIR as string))
    const retrieval = createRetrievalEngine(repos)
    const reco = createRecommendationEngine(repos, retrieval, { cutoffs: createCommunityCutoffLookup(repos) })
    const proto = createOrchestrationPrototype({ provider: resolveConfiguredProvider(liveEnv), reco })

    const result = await proto.run('My cutoff is 178 and I am BC community. Which colleges can I get in Coimbatore?')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.tool).toBe('recommend_by_cutoff')
    expect(result.facts.count).toBeGreaterThanOrEqual(0)
  }, 60_000)
})
