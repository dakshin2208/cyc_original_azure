/**
 * @module lib/ai/chat/__tests__/unsupported-topic.test
 *
 * The counsellor must not answer a question the parent did not ask.
 *
 * A retry guard existed so that a complete-profile user whose phrasing missed the keyword table
 * ("tell me the collage what i get") still got colleges instead of a deflection. But it fired on
 * ANY message the classifier failed to understand, rewriting it into "recommend the best
 * colleges for me". So a parent asking "when is the TNEA deadline?" received:
 *
 *     "Based on your profile — Cutoff 190 · OC · Chennai · CSE:
 *      My top recommendation is Chennai Institute of Technology — ₹4.6L median salary, 83% placement…"
 *
 * Confidently answering the wrong question is worse than admitting ignorance, and it is exactly
 * the "confidently wrong" failure the product exists to avoid. The retry is now gated on the
 * message ACTUALLY ASKING FOR COLLEGES; anything else gets an honest limitation.
 *
 * Both halves are tested together on purpose: a fix that silences the bad case by also killing
 * the legitimate off-keyword recommendation would fail the second half of this file.
 */

import { describe, expect, it } from 'vitest'
import { createUnavailableProvider } from '@/lib/ai/llm'
import {
  buildCounselorChatService,
  createNullLogger,
  createRecordingAnalytics,
  type ChatResponse,
} from '@/lib/ai/chat'

const DIR = process.env.CYC_DATA_DIR

const RECOMMENDATION = /my top recommendation|other strong options/i
const HONEST_DECLINE = /don'?t have that one|not in the official college dataset|won'?t guess/i

describe.skipIf(!DIR)('a complete profile + an un-understood question', () => {
  const make = () => {
    const analytics = createRecordingAnalytics()
    const svc = buildCounselorChatService({
      dataDir: DIR,
      logger: createNullLogger(),
      provider: createUnavailableProvider('none'), // deterministic path
      analytics,
    })
    return { svc, analytics }
  }
  const b = (o: { body: unknown }) => o.body as ChatResponse

  /** Establish a COMPLETE profile, then ask. */
  const askWithProfile = async (question: string) => {
    const { svc, analytics } = make()
    const first = b(await svc.handle({ message: '190 OC Chennai CSE' }))
    expect(first.profile?.complete).toBe(true)
    const out = b(await svc.handle({ message: question, conversationId: first.conversationId }))
    return { answer: out.answer ?? '', analytics }
  }

  describe('TNEA process questions → an honest "I don\'t have that", NEVER a recommendation', () => {
    const process: readonly string[] = [
      'when is the TNEA deadline?',
      'can I change branch after first year?',
      'what documents are needed?',
      'what happens in round 2 of counselling?',
      'how do I apply?',
    ]
    for (const q of process) {
      it(`✗ "${q}" → declines honestly`, async () => {
        const { answer } = await askWithProfile(q)
        expect(answer).not.toMatch(RECOMMENDATION) // ← the bug: a college nobody asked for
        expect(answer).toMatch(HONEST_DECLINE)
        // It says what it CAN do instead of leaving the parent stranded.
        expect(answer).toMatch(/colleges you can realistically get|compare|placements/i)
        // And it does not invent a portal URL, a date, or a document list.
        expect(answer).not.toMatch(/https?:\/\/|www\.|\b20\d\d\b/)
      })
    }

    it('✓ the decline is reported as an honest_limitation (measurable on live traffic)', async () => {
      const { analytics } = await askWithProfile('when is the TNEA deadline?')
      const ev = analytics.events.find((e) => e.type === 'honest_limitation') as { topic?: string } | undefined
      expect(ev).toBeDefined()
      expect(ev!.topic).toBe('unsupported_topic')
    })

    it('✓ a decline is not dressed in counselling framing', async () => {
      // "Based on your profile — Cutoff 190 · OC · Chennai:  I don't have TNEA deadlines…
      //  Would you like me to compare this with another college?" reads like it didn't listen.
      const { answer } = await askWithProfile('when is the TNEA deadline?')
      expect(answer).not.toMatch(/^Based on your profile/i)
      expect(answer).not.toMatch(/compare this with another college/i)
    })
  })

  describe('REGRESSION: a real ask for colleges still gets colleges', () => {
    // Every one of these is a genuine recommendation ask whose phrasing misses the keyword
    // table. They are the reason the retry guard exists, and they must keep working.
    const asks: readonly string[] = [
      'which should I pick?',
      'any good colleges for me?',
      'give me colleges',
      'give me the college name',
      'any college',
      'any collage',
      'college names with my cutoff',
      'options for me',
      'tell me the collage what i get',
      'suggest me the collage',
      'which collage i get',
    ]
    for (const q of asks) {
      it(`✓ "${q}" → still recommends`, async () => {
        const { answer } = await askWithProfile(q)
        expect(answer).toMatch(RECOMMENDATION)
        expect(answer).not.toMatch(HONEST_DECLINE)
      })
    }
  })

  it('✓ a vague message ("???") re-orients — it neither recommends nor falsely declines', async () => {
    const { answer } = await askWithProfile('???')
    expect(answer).toMatch(/i have your details saved/i)
    expect(answer).not.toMatch(RECOMMENDATION)
    expect(answer).not.toMatch(/share your cutoff/i) // never re-ask for what it has
  })
})
