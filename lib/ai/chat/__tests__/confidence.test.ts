/**
 * @module lib/ai/chat/__tests__/confidence.test
 *
 * Phase 6 (RC5) — confidence tracks the ANSWER's quality, not data completeness.
 * HIGH only when intent + district + eligibility + warehouse grounding all hold.
 * Gated on the real warehouse (district/eligibility need the 2026 data).
 */

import { describe, expect, it } from 'vitest'
import { buildCounselorChatService } from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

describe.skipIf(!DIR)('counselor chat service — confidence (RC5)', () => {
  const svc = buildCounselorChatService({ dataDir: DIR as string })
  const conf = async (q: string) =>
    ((await svc.handle({ message: q })).body as { confidence: string }).confidence

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
