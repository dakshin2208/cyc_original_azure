/**
 * @module lib/opinion/__tests__/support
 *
 * Test fixtures for the Opinion Engine. Reuses the Sprint 4 orchestration fixture
 * (compact real warehouse) for repos + retrieval + a parser, and provides
 * provider doubles + a cutoff lookup so eligibility banding can be exercised.
 * Excluded from the production build.
 */

import {
  createTableCutoffLookup,
  type CutoffLookup,
} from '@/lib/recommendation'
import { createFunctionProvider, type LLMProvider } from '@/lib/ai/llm'
import { createOpinionService, type OpinionServiceOptions } from '@/lib/opinion'
import { makeHarness, NAME } from '../../ai/orchestration/__tests__/support'

export { NAME }

const harness = makeHarness()
export const repos = harness.repos
export const retrieval = harness.retrieval
/** The Sprint 4 orchestrator (to obtain {parsed, context} in unit tests). */
export const orchestrator = harness.ai

/** Build an opinion service over the fixture warehouse. */
export function makeOpinion(options?: OpinionServiceOptions) {
  return createOpinionService(repos, retrieval, options)
}

/** A cutoff lookup that makes PSG a reach, Anna a safe, Kumaraguru a target for OC. */
export function bandedCutoffs(): CutoffLookup {
  const id = (name: string): string => repos.colleges.list().find((c) => c.name === name)!.id
  return createTableCutoffLookup([
    { collegeId: id(NAME.anna), community: 'OC', closingCutoff: 150 }, // 190 → +40 → safe
    { collegeId: id(NAME.kumaraguru), community: 'OC', closingCutoff: 185 }, // 190 → +5 → target
    { collegeId: id(NAME.psg), community: 'OC', closingCutoff: 193 }, // 190 → -3 → reach
  ])
}

/** A provider that cites the first evidence id in the prompt (grounded model). */
export function citingProvider(name = 'mock'): LLMProvider {
  return createFunctionProvider(name, (req) => {
    const text = req.messages.map((m) => m.content).join('\n')
    const match = text.match(/\[([^\]\s]+)\]/) // first bracketed evidence id
    const id = match?.[1] ?? null
    return {
      text: JSON.stringify({
        answer: 'Here is my grounded counsel based on the recommendations.',
        citations: id ? [{ evidenceId: id, collegeName: null, label: 'evidence', source: 'retrieval' }] : [],
        followUps: [],
        confidence: 'high',
        hadMissingInformation: false,
      }),
    }
  })
}

/** A provider that cites a fabricated evidence id (forces rejection). */
export function fabricatingProvider(name = 'liar'): LLMProvider {
  return createFunctionProvider(name, () => ({
    text: JSON.stringify({
      answer: 'Fantastic Institute of Nowhere is the best choice.',
      citations: [{ evidenceId: 'totally-made-up', collegeName: null, label: 'x', source: 'retrieval' }],
      confidence: 'high',
    }),
  }))
}
