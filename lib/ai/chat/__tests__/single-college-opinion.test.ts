/**
 * @module lib/ai/chat/__tests__/single-college-opinion.test
 *
 * Regression guard for the #1 client complaint: an EVALUATIVE question about ONE named
 * college ("is kumaraguru collage is best collage ?") was answered about a DIFFERENT
 * college (Anna University), because the intent classifier fired a global
 * `recommend_college` on the word "best" and the strategy then recommended globally.
 *
 * After the fix the answer must be ABOUT the named college — stating where it actually
 * stands (TN-wide rank + CYC Power Score, both from the deterministic engine) — with no
 * empty-profile echo and no false "no cutoff data" claim. Runs over the SHIPPED `data/`
 * on the deterministic (no-LLM) path, proving the no-key path is correct too.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup } from '@/lib/recommendation'
import { createOpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  emptyProfile,
  resolveDistrict,
  type ChatResponse,
  type StudentProfile,
} from '@/lib/ai/chat'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('single-college opinion — answers the question that was asked', () => {
  const repos = createRepositories(buildWarehouseFromDirectory(DATA_DIR))
  const retrieval = createRetrievalEngine(repos)
  const cutoffs = createCommunityCutoffLookup(repos)
  const known = new Set<string>()
  for (const c of repos.colleges.list()) {
    const d = repos.colleges.districtOf(c.id)
    if (d) known.add(d.toLowerCase())
  }
  const opinion = createOpinionService(repos, retrieval, { provider: createUnavailableProvider('none'), cutoffs, systemPrompt: composeCounselorSystem() })

  let n = 0
  const complete = (): StudentProfile =>
    ({ ...emptyProfile(), cutoff: 190, community: 'OC', district: 'coimbatore', branch: 'CSE', answered: { cutoff: true, community: true, district: true, branch: true } }) as StudentProfile

  async function ask(message: string, seed?: StudentProfile): Promise<string> {
    const profileStore = createInMemoryProfileStore()
    const conv = `sc-${(n += 1)}`
    if (seed) await profileStore.set(conv, seed)
    const service = createCounselorChatService({
      opinion,
      sessionStore: createInMemorySessionStore(),
      profileStore,
      logger: createNullLogger(),
      clock: () => 0,
      idGenerator: () => conv,
      timeoutMs: 8000,
      resolveDistrict: (x) => resolveDistrict(x, known),
    })
    return ((await service.handle({ message, conversationId: conv })).body as ChatResponse).answer
  }

  it('"is kumaraguru collage is best collage ?" → answers ABOUT Kumaraguru (rank + Power Score)', async () => {
    const a = await ask('is kumaraguru collage is best collage ?')
    expect(a).toMatch(/Kumaraguru College of Technology/i) // names the college asked about
    expect(a).toMatch(/CYC Power Score \d+(\.\d+)?/i) // the REAL branded score
    expect(a).toMatch(/#\d+ in Tamil Nadu by Power Score/i) // ranked BY that same score
    expect(a).not.toMatch(/^.*My top recommendation is Anna University/im) // never leads with a different college
    expect(a).not.toMatch(/Based on your profile/i) // no empty-profile echo
    expect(a).not.toMatch(/no historical cutoff data/i) // Kumaraguru HAS a cutoff on file
    expect(a).toMatch(/need your cutoff and community/i) // honest: we lack the STUDENT's cutoff
  })

  it('"is PSG College of Technology the best?" → answers about PSG, and OMITS the Power Score (it has none on file)', async () => {
    const a = await ask('is PSG College of Technology the best?')
    expect(a).toMatch(/PSG College of Technology/i)
    expect(a).not.toMatch(/My top recommendation is Anna University/i)
    // PSG has powerScore = null in the warehouse. The label must be omitted ENTIRELY —
    // never faked from the engine's internal match score.
    expect(a).not.toMatch(/CYC Power Score/i)
    expect(a).not.toMatch(/by Power Score/i)
  })

  it('"how good is Kumaraguru College of Technology" → answers about Kumaraguru', async () => {
    const a = await ask('how good is Kumaraguru College of Technology')
    expect(a).toMatch(/Kumaraguru College of Technology/i)
    expect(a).toMatch(/CYC Power Score \d+(\.\d+)?/i)
    expect(a).not.toMatch(/My top recommendation is Anna University/i)
  })

  // ── Regressions: the paths that already worked must keep working ──────────────
  it('"tell me about X" still answers about X (and never demands a profile first)', async () => {
    const a = await ask('tell me about Kumaraguru College of Technology')
    expect(a).toMatch(/Kumaraguru College of Technology/i)
    expect(a).not.toMatch(/what is your cutoff/i)
  })

  it('"what are the placements at X" still answers about X', async () => {
    const a = await ask('what are the placements at Kumaraguru College of Technology?')
    expect(a).toMatch(/Kumaraguru College of Technology/i)
    expect(a).toMatch(/median salary|placement/i)
  })

  it('"compare X and Y" still compares both', async () => {
    const a = await ask('compare PSG College of Technology and Kumaraguru College of Technology')
    expect(a).toMatch(/PSG College of Technology/i)
    expect(a).toMatch(/Kumaraguru College of Technology/i)
    expect(a).toMatch(/compare|lean towards/i)
  })

  it('a TRUE global ask ("which college is best for me?") with a profile still recommends globally', async () => {
    const a = await ask('which college is best for me?', complete())
    expect(a).toMatch(/Based on your profile/i) // profile IS echoed when one exists
    expect(a).toMatch(/My top recommendation is/i)
    expect(a).toMatch(/Other strong options/i) // a real multi-college list, not a single-college verdict
    expect(a).not.toMatch(/CYC Power Score/i) // Power Score is a single-college verdict, not list noise
  })
})
