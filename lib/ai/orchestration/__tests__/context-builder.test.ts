/**
 * @module lib/ai/orchestration/__tests__/context-builder.test
 * ContextBuilder — structured context, gaps, follow-ups, confidence, no prompts.
 */

import { describe, expect, it } from 'vitest'
import { makeHarness, NAME } from './support'

const { ai } = makeHarness()

describe('context builder', () => {
  it('produces a structured context WITHOUT any prompt text', () => {
    const { context } = ai.orchestrate('recommend the best college')
    expect(Object.keys(context)).not.toContain('prompt')
    expect(Object.keys(context)).not.toContain('messages')
    expect(context.intent).toBe('recommend_college')
    expect(context.recommendations.length).toBeGreaterThan(0)
    expect(['high', 'medium', 'low']).toContain(context.confidence.level)
    expect(context.confidence.evidenceCompleteness).toBeGreaterThanOrEqual(0)
    expect(context.confidence.evidenceCompleteness).toBeLessThanOrEqual(1)
  })

  it('surfaces blocking gaps + follow-ups for eligibility without cutoff/community', () => {
    const { context } = ai.orchestrate('am i eligible for a good college')
    const fields = context.missingInformation.map((m) => m.field)
    expect(fields).toContain('cutoff')
    expect(fields).toContain('community')
    expect(fields).toContain('cutoff_dataset')
    expect(context.missingInformation.some((m) => m.severity === 'blocking')).toBe(true)
    expect(context.followUpQuestions.length).toBeGreaterThan(0)
  })

  it('records the missing cutoff dataset even when cutoff + community are supplied', () => {
    const { context } = ai.orchestrate('can i get into anna university with 195 cutoff in BC')
    expect(context.missingInformation.some((m) => m.field === 'cutoff_dataset')).toBe(true)
    // Eligibility is degraded (unknown), not fabricated.
    expect(context.recommendations.every((r) => r.eligibility?.category === 'unknown')).toBe(true)
  })

  it('flags fees as unavailable (not in the dataset)', () => {
    const { context } = ai.orchestrate('what is the fee at psg college of technology')
    expect(context.missingInformation.some((m) => m.field === 'fees_dataset')).toBe(true)
  })

  it('carries subjects and a comparison for a compare query', () => {
    const { context } = ai.orchestrate(`compare ${NAME.psg} and ${NAME.anna}`)
    expect(context.comparison).not.toBeNull()
    expect(context.subjects.map((c) => c.name)).toEqual(expect.arrayContaining([NAME.psg, NAME.anna]))
  })

  it('gives unknown queries a low overall confidence', () => {
    const { context } = ai.orchestrate('asdf qwer zxcv')
    expect(context.intent).toBe('unknown')
    expect(context.confidence.overall).toBeLessThan(0.3)
  })
})
