/**
 * @module lib/ai/chat/__tests__/confidence.test
 *
 * Phase 6 (RC5) — confidence tracks the ANSWER's quality, not data completeness.
 * HIGH only when intent + district + eligibility + warehouse grounding all hold.
 * Built WITHOUT the profile layer to isolate the answer-pipeline confidence; the
 * conversational-flow tests cover confidence through the profile. Gated on the real
 * warehouse (district/eligibility need the 2026 data).
 *
 * The warehouse/service are built LAZILY inside a memoized `setup()` so the suite
 * skips cleanly — without throwing during collection — when `CYC_DATA_DIR` is unset.
 */

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createNirf2026CutoffLookup } from '@/lib/recommendation'
import { createOpinionService } from '@/lib/opinion'
import { createCounselorChatService, createInMemorySessionStore, createNullLogger } from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

let cached: { svc: ReturnType<typeof createCounselorChatService> } | null = null
function setup() {
  if (!cached) {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const retrieval = createRetrievalEngine(repos)
    const cutoffs = createNirf2026CutoffLookup(
      new Map([...wh.nirf2026.byCollege].map(([id, p]) => [id, p.ocCutoff])),
    )
    const opinion = createOpinionService(repos, retrieval, { cutoffs }) // deterministic (no provider)
    const svc = createCounselorChatService({
      opinion,
      sessionStore: createInMemorySessionStore(),
      logger: createNullLogger(),
      clock: () => 0,
      idGenerator: () => 'conf',
      timeoutMs: 5000,
      // no profileStore → immediate-answer mode
    })
    cached = { svc }
  }
  return cached
}

describe.skipIf(!DIR || !existsSync(DIR as string))('counselor chat service — confidence (RC5)', () => {
  const conf = async (q: string) =>
    ((await setup().svc.handle({ message: q })).body as { confidence: string }).confidence

  it('HIGH only for well-constrained, in-district, eligibility-verified queries', async () => {
    expect(await conf('CSE in Coimbatore with BC 190')).toBe('high')
    expect(await conf('ECE in Chennai BC 190')).toBe('high')
  })

  it('MEDIUM for grounded but generic queries (no district/eligibility)', async () => {
    expect(await conf('best engineering colleges')).toBe('medium')
  })

  it('LOW for declined or insufficient queries', async () => {
    expect(await conf('MBBS in Chennai')).toBe('low') // domain decline
    expect(await conf('Hogwarts Engineering College')).toBe('low') // unknown-entity decline
    expect(await conf('asdfghjkl qwerty')).toBe('low') // insufficient evidence
  })
})
