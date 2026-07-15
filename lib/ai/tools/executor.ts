/**
 * @module lib/ai/tools/executor
 *
 * Deliverable 4 — the orchestration executor.
 *
 * Wires the smallest end-to-end pipeline:
 *
 *   question → LLM understand → ToolRequest → existing recommendation engine → facts
 *
 * It calls the EXISTING Azure/OpenAI provider exactly as it is today
 * (`provider.complete`, JSON mode) — no provider change — and dispatches the one
 * supported tool to the existing engine. No writer, no second LLM, no route or
 * provider modification. Everything is injected (DI); this module constructs nothing.
 */

import type { LLMProvider } from '@/lib/ai/llm'
import type { RecommendationEngine } from '@/lib/recommendation'
import { understandMessages } from './understand-prompt'
import { parseToolRequest, type ToolRequest } from './tool-request'
import { executeRecommendByCutoff, type RecommendationFacts } from './recommendation-tool'
import type { ToolResult } from './tool'
import type { ToolPlan } from './tool-plan'
import type { ToolRegistry } from './registry'

/**
 * Commit 3 — the GENERIC executor. Run a {@link ToolPlan} against the registry and
 * return the first tool that yields a routing instruction. It only ever calls
 * `registry.execute(name, args)` — it never knows a specific tool name and contains
 * NO `if tool === …` branches. The schema supports multiple calls; today the first
 * call that resolves wins (future multi-call fan-out plugs in here unchanged).
 */
export function executePlan(plan: ToolPlan, registry: ToolRegistry): ToolResult | null {
  for (const call of plan.calls) {
    const result = registry.execute(call.tool, call.arguments)
    if (result) return result
  }
  return null
}

/** Injected dependencies for the prototype. */
export interface OrchestrationDeps {
  /** The existing Azure/OpenAI provider (unchanged), used for the understand call. */
  readonly provider: LLMProvider
  /** The existing recommendation engine (unchanged), used as the tool. */
  readonly reco: RecommendationEngine
  /** Sampling temperature for the understand call (default 0 = deterministic). */
  readonly temperature?: number
}

/** Result of the understanding step alone. */
export type UnderstandResult =
  | { readonly ok: true; readonly request: ToolRequest }
  | { readonly ok: false; readonly error: string }

/** Result of the full prototype run. */
export type RunResult =
  | { readonly ok: true; readonly request: ToolRequest; readonly facts: RecommendationFacts }
  | { readonly ok: false; readonly stage: 'understand'; readonly error: string }

/** The prototype's public surface. */
export interface OrchestrationPrototype {
  /** LLM call 1 only: question → validated tool request. */
  understand(question: string): Promise<UnderstandResult>
  /** Full pipeline: question → tool request → engine → structured facts. */
  run(question: string): Promise<RunResult>
}

/** Create the orchestration prototype over an injected provider + engine. */
export function createOrchestrationPrototype(deps: OrchestrationDeps): OrchestrationPrototype {
  const understand = async (question: string): Promise<UnderstandResult> => {
    const completion = await deps.provider.complete({
      messages: understandMessages(question),
      responseFormat: 'json',
      temperature: deps.temperature ?? 0,
    })
    const parsed = parseToolRequest(completion.text)
    return parsed.ok ? { ok: true, request: parsed.request } : { ok: false, error: parsed.error }
  }

  const run = async (question: string): Promise<RunResult> => {
    const understood = await understand(question)
    if (!understood.ok) return { ok: false, stage: 'understand', error: understood.error }
    const facts = executeRecommendByCutoff(deps.reco, understood.request)
    return { ok: true, request: understood.request, facts }
  }

  return Object.freeze({ understand, run })
}
