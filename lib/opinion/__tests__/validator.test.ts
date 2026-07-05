/**
 * @module lib/opinion/__tests__/validator.test
 * Opinion Response Validator (Module 5) — the opinion-specific gate.
 */

import { describe, expect, it } from 'vitest'
import type { AIResponse, ResponseCitation } from '@/lib/ai/orchestration'
import type { LLMResponseStatus, LLMResult } from '@/lib/ai/llm'
import { validateOpinionResponse } from '@/lib/opinion'
import { makeOpinion, orchestrator } from './support'

const svc = makeOpinion()
const orch = orchestrator.orchestrate('recommend the best college')
const prepared = svc.engine.prepare(orch.parsed, orch.context)
const evidenceId = prepared.opinionContext.evidence.items[0]?.id ?? 'ev:missing'
const candidate = prepared.opinionContext.candidates[0]?.college.name ?? 'Unknown'

function llm(status: LLMResponseStatus, citations: ResponseCitation[]): LLMResult {
  const response: AIResponse = { answer: 'Grounded counsel.', citations, followUps: [], confidence: 'high', hadMissingInformation: false }
  return { status, response, issues: [], attempts: 1, raw: '{}', provider: 'test' }
}

describe('validateOpinionResponse', () => {
  it('accepts an answer that cites real evidence for a candidate college', () => {
    const out = validateOpinionResponse(
      llm('ok', [{ evidenceId, collegeName: candidate, label: 'x', source: 'retrieval' }]),
      prepared.result,
      prepared.opinionContext,
    )
    expect(out.ok).toBe(true)
  })

  it('rejects a citation to unknown evidence', () => {
    const out = validateOpinionResponse(
      llm('ok', [{ evidenceId: 'made-up', collegeName: null, label: 'x', source: 'retrieval' }]),
      prepared.result,
      prepared.opinionContext,
    )
    expect(out.ok).toBe(false)
  })

  it('rejects a citation to a non-candidate college', () => {
    const out = validateOpinionResponse(
      llm('ok', [{ evidenceId, collegeName: 'Imaginary Institute', label: 'x', source: 'retrieval' }]),
      prepared.result,
      prepared.opinionContext,
    )
    expect(out.ok).toBe(false)
  })

  it('rejects a substantive answer with no citations', () => {
    expect(validateOpinionResponse(llm('ok', []), prepared.result, prepared.opinionContext).ok).toBe(false)
  })

  it('rejects when the Sprint-5 pipeline fell back', () => {
    expect(
      validateOpinionResponse(
        llm('provider_error', [{ evidenceId, collegeName: candidate, label: 'x', source: 'retrieval' }]),
        prepared.result,
        prepared.opinionContext,
      ).ok,
    ).toBe(false)
  })

  it('never trusts the model when evidence was insufficient', () => {
    const gibberish = orchestrator.orchestrate('asdfghjkl')
    const bad = svc.engine.prepare(gibberish.parsed, gibberish.context)
    expect(bad.result.strategy).toBe('insufficient_evidence')
    // Even a well-formed model reply is discarded in favour of the deterministic answer.
    const out = validateOpinionResponse(
      llm('ok', [{ evidenceId, collegeName: candidate, label: 'x', source: 'retrieval' }]),
      bad.result,
      bad.opinionContext,
    )
    expect(out.ok).toBe(false)
  })
})
