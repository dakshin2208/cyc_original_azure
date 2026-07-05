/**
 * @module lib/ai/llm/__tests__/support
 *
 * Test fixtures for the LLM Integration Layer. Reuses the Sprint 4 orchestrator
 * (over a compact real warehouse) to produce genuine {@link PromptPackage} +
 * {@link ContextPackage} pairs, and provides deterministic provider doubles (no
 * SDK, no network). Excluded from the production build.
 */

import type { ContextPackage, PromptPackage } from '@/lib/ai/orchestration'
import {
  createFunctionProvider,
  createStaticProvider,
  type LLMProvider,
} from '@/lib/ai/llm'
import { makeHarness, NAME } from '../../orchestration/__tests__/support'

export { NAME }

const { ai } = makeHarness()

/** Orchestrate a question through Sprint 4 and return its prompt + context. */
export function ask(question: string): { prompt: PromptPackage; context: ContextPackage } {
  const r = ai.orchestrate(question)
  return { prompt: r.prompt, context: r.context }
}

/** A provider that returns a fixed object serialized as JSON. */
export function jsonProvider(obj: unknown, name = 'mock'): LLMProvider {
  return createStaticProvider(name, JSON.stringify(obj))
}

/** A provider that returns a fixed raw string (may be non-JSON). */
export function textProvider(text: string, name = 'mock'): LLMProvider {
  return createStaticProvider(name, text)
}

/** A provider that returns each text in sequence across successive calls. */
export function sequenceProvider(texts: readonly string[], name = 'seq'): LLMProvider {
  let i = 0
  return createFunctionProvider(name, () => ({ text: texts[Math.min(i++, texts.length - 1)] }))
}

/** Count how many times a provider was invoked (for retry assertions). */
export function countingProvider(
  responder: () => string,
  name = 'count',
): { provider: LLMProvider; calls: () => number } {
  let calls = 0
  const provider = createFunctionProvider(name, () => {
    calls += 1
    return { text: responder() }
  })
  return { provider, calls: () => calls }
}

/** Build a well-formed model reply that cites the first real evidence item. */
export function goodReply(context: ContextPackage): Record<string, unknown> {
  const ev = context.evidence.items[0]
  const college = ev?.collegeName ?? context.subjects[0]?.name ?? null
  return {
    answer: college ? `${college} is a strong choice based on the supplied data.` : 'Here is what the data supports.',
    citations: ev ? [{ evidenceId: ev.id, collegeName: ev.collegeName, label: ev.label, source: ev.source }] : [],
    followUps: [],
    confidence: 'high',
    hadMissingInformation: false,
  }
}
