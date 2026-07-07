/**
 * @module lib/ai/chat/__tests__/parser-unverified.test
 *
 * Regression guard for the Internal-Beta defect: valid knowledge/eligibility/reputation
 * queries about REAL colleges were mis-classified as `unverifiedCollege=true` (→ "I
 * couldn't verify that college"). The fix (a) resolves a real college named after topic
 * noise via a span anchored at a SINGULAR institution word, and (b) restricts the
 * unverified-college heuristic to SINGULAR institution words so plural "colleges" (a
 * category phrase) never flags. Unknown SINGULAR names must STILL be rejected — the
 * hallucination guard is unchanged. Runs over the shipped `data/` (skips if absent).
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createOpinionService } from '@/lib/opinion'
import { composeCounselorSystem, createUnavailableProvider } from '@/lib/ai/llm'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('parser — unverifiedCollege (real vs unknown)', () => {
  const repos = createRepositories(buildWarehouseFromDirectory(DATA_DIR))
  const op = createOpinionService(repos, createRetrievalEngine(repos), { provider: createUnavailableProvider('none'), systemPrompt: composeCounselorSystem() })
  const parse = (q: string) => op.parse(q) as { colleges: string[]; unverifiedCollege: boolean }

  it('RESOLVES a real college named after topic/intent noise', () => {
    for (const q of [
      'how is the faculty at Anna University?',
      'what is the median salary at Anna University?',
      'higher studies percentage at PSG College of Technology',
      'will I definitely get into PSG College of Technology?',
    ]) {
      const p = parse(q)
      expect(p.unverifiedCollege, q).toBe(false)
      expect(p.colleges.length, q).toBeGreaterThan(0)
    }
  })

  it('treats plural "colleges" as a CATEGORY, not an unknown named college', () => {
    for (const q of ['best reputation colleges', 'the best overall colleges', 'show me government colleges only']) {
      const p = parse(q)
      expect(p.unverifiedCollege, q).toBe(false)
      expect(p.colleges.length, q).toBe(0) // category phrase — no specific college
    }
  })

  it('STILL rejects an unknown SINGULAR college name (hallucination guard unchanged)', () => {
    for (const q of ['is Hogwarts Institute of Technology good?', 'is Fake College any good?', 'Hogwarts Engineering College']) {
      const p = parse(q)
      expect(p.unverifiedCollege, q).toBe(true)
      expect(p.colleges.length, q).toBe(0)
    }
  })

  it('does not regress comparison of two real colleges', () => {
    const p = parse('compare PSG College of Technology and Anna University')
    expect(p.unverifiedCollege).toBe(false)
    expect(p.colleges.length).toBeGreaterThanOrEqual(2)
  })
})
