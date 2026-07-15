/**
 * @module lib/ai/llm/__tests__/guard.test
 * Hallucination guard — removes fabricated figures & hallucinated colleges;
 * replaces an all-unsupported answer with the insufficient-evidence text.
 */

import { describe, expect, it } from 'vitest'
import type { AIResponse } from '@/lib/ai/orchestration'
import { applyHallucinationGuard, buildGrounding } from '@/lib/ai/llm'
import { ask, NAME } from './support'

const { context } = ask(`what are the placements at ${NAME.psg}`)
const grounding = buildGrounding(context)
const median = context.facts.find((f) => f.label.startsWith('Median'))?.value as number
const INSUFFICIENT = "I don't have sufficient evidence."

const reply = (answer: string): AIResponse => ({
  answer,
  citations: [],
  followUps: [],
  confidence: 'high',
  hadMissingInformation: false,
})

describe('hallucination guard', () => {
  it('keeps a sentence whose figure is backed by evidence', () => {
    const out = applyHallucinationGuard(reply(`${NAME.psg} reports a median salary of ${median} rupees.`), grounding, INSUFFICIENT)
    expect(out.removed).toHaveLength(0)
    expect(out.response.answer).toContain(String(median))
  })

  it('removes a sentence that asserts a fabricated salary figure', () => {
    const good = `${NAME.psg} has strong outcomes.`
    const bad = `Its median salary is 9999999 rupees.`
    const out = applyHallucinationGuard(reply(`${good} ${bad}`), grounding, INSUFFICIENT)
    expect(out.removed).toContain(bad)
    expect(out.response.answer).toBe(good)
    expect(out.issues.some((i) => i.code === 'fabricated_figure')).toBe(true)
  })

  it('removes a sentence that names a hallucinated college', () => {
    const out = applyHallucinationGuard(reply('Nonexistent Institute of Wizardry is the best.'), grounding, INSUFFICIENT)
    expect(out.issues.some((i) => i.code === 'hallucinated_college')).toBe(true)
    expect(out.response.answer).toBe(INSUFFICIENT) // all sentences removed
  })

  it('does not flag a plausible year', () => {
    const out = applyHallucinationGuard(reply(`${NAME.psg} has improved its placements since 2019.`), grounding, INSUFFICIENT)
    expect(out.removed).toHaveLength(0)
  })

  it('does not flag a generic "This College" phrase', () => {
    const out = applyHallucinationGuard(reply('This College has a solid reputation.'), grounding, INSUFFICIENT)
    expect(out.removed).toHaveLength(0)
  })

  it('flags a fabricated percentage but keeps a real one', () => {
    const rate = context.facts.find((f) => f.label.startsWith('Placement rate'))?.value as number
    const good = `${NAME.psg} placed ${rate}% of its students.`
    const bad = `It also placed 37% into higher studies.`
    const out = applyHallucinationGuard(reply(`${good} ${bad}`), grounding, INSUFFICIENT)
    expect(out.response.answer).toContain(`${rate}%`)
    expect(out.removed).toContain(bad)
  })

  it('leaves a fully-supported multi-sentence answer unchanged', () => {
    const answer = `${NAME.psg} is a strong option. It has a good academic reputation.`
    const out = applyHallucinationGuard(reply(answer), grounding, INSUFFICIENT)
    expect(out.response.answer).toBe(answer)
    expect(out.removed).toHaveLength(0)
  })

  // Bug 3: a repair must never ship a fragment that opens with a dangling connective/pronoun.
  describe('repair leaves coherent prose (no dangling opener)', () => {
    it('strips a leading connective left by a removed sentence', () => {
      // Sentence 1 fabricates a figure (removed); sentence 2 opens with "However,".
      const bad = `Its median salary is 8888888 rupees.`
      const kept = `However, ${NAME.psg} has a strong academic reputation.`
      const out = applyHallucinationGuard(reply(`${bad} ${kept}`), grounding, INSUFFICIENT)
      expect(out.removed).toContain(bad)
      expect(out.response.answer).not.toMatch(/^However/i) // the dangling opener, gone
      expect(out.response.answer).toMatch(/academic reputation/i) // the real content survives
    })

    it('drops an orphaned pronoun opener when another supported sentence remains', () => {
      // Sentence 1 fabricates (removed) and was the pronoun's antecedent; two clean sentences remain.
      const bad = `Its placement rate is 42% into foreign universities.`
      const out = applyHallucinationGuard(
        reply(`${bad} It is well regarded. ${NAME.psg} has a good reputation.`),
        grounding,
        INSUFFICIENT,
      )
      expect(out.removed).toContain(bad)
      expect(out.response.answer).not.toMatch(/^It\b/) // no orphaned pronoun subject
      expect(out.response.answer).toMatch(/good reputation/i)
    })
  })
})
