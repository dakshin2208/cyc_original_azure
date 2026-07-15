/**
 * @module lib/ai/tools/understanding
 *
 * The production-safe understanding entry (LLM-primary, deterministic-fallback).
 * `createToolUnderstanding` runs the FIRST LLM call, parses the tool plan, and
 * executes it through the generic registry — returning a {@link ToolResult} on
 * success, or `null` (→ the coordinator's deterministic fallback) on ANY of the
 * documented failure modes, each reported via `onOutcome`:
 *
 *   • timeout      — the LLM call exceeded the understand budget
 *   • error        — the provider rejected (network / provider fault)
 *   • malformed    — the reply was not a valid tool-plan JSON
 *   • empty        — a valid plan with zero calls (LLM chose not to act)
 *   • unsupported  — no planned tool produced an actionable result
 *
 * It holds NO chat dependency (observability is a plain callback), so the tool
 * layer stays free of any `lib/ai/chat` import (no cycle). It never throws.
 */

import type { LLMProvider } from '@/lib/ai/llm'
import { planMessages } from './understand-prompt'
import { parseToolPlan } from './tool-plan'
import { executePlan } from './executor'
import { createDefaultToolRegistry, type ToolRegistry } from './registry'
import type { ToolResult } from './tool'

/** Why the LLM (primary) path yielded nothing → the deterministic router takes the turn. */
export type FallbackReason = 'timeout' | 'malformed' | 'empty' | 'unsupported' | 'error'

/** The orchestration outcome for one turn (for observability). */
export interface OrchestrationOutcome {
  readonly path: 'llm' | 'deterministic_fallback'
  readonly reason: FallbackReason | null
}

/** Dependencies for {@link createToolUnderstanding}. */
export interface ToolUnderstandingDeps {
  readonly registry?: ToolRegistry
  /** Understand-call budget in ms (default 8000). On timeout → deterministic fallback. */
  readonly timeoutMs?: number
  /** Observability hook, called once per invocation with the path taken + reason. */
  readonly onOutcome?: (conversationId: string, outcome: OrchestrationOutcome) => void
}

type Raced<T> = { readonly status: 'ok'; readonly value: T } | { readonly status: 'timeout' } | { readonly status: 'error' }

/** Race a promise against a timeout; never rejects (maps rejection → 'error'). */
function withUnderstandTimeout<T>(promise: Promise<T>, ms: number): Promise<Raced<T>> {
  if (!ms || ms <= 0) {
    return promise.then(
      (value): Raced<T> => ({ status: 'ok', value }),
      (): Raced<T> => ({ status: 'error' }),
    )
  }
  return new Promise<Raced<T>>((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve({ status: 'timeout' })
      }
    }, ms)
    promise.then(
      (value) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ status: 'ok', value })
        }
      },
      () => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ status: 'error' })
        }
      },
    )
  })
}

/** Build the LLM-primary understanding function. Returns null → deterministic fallback. */
export function createToolUnderstanding(
  provider: LLMProvider,
  deps: ToolUnderstandingDeps = {},
): (message: string, conversationId: string) => Promise<ToolResult | null> {
  const registry = deps.registry ?? createDefaultToolRegistry()
  const timeoutMs = deps.timeoutMs ?? 8000
  const emit = deps.onOutcome ?? (() => undefined)
  const fallback = (conversationId: string, reason: FallbackReason): null => {
    emit(conversationId, { path: 'deterministic_fallback', reason })
    return null
  }

  return async (message, conversationId): Promise<ToolResult | null> => {
    const raced = await withUnderstandTimeout(
      provider.complete({ messages: planMessages(message), responseFormat: 'json', temperature: 0 }),
      timeoutMs,
    )
    if (raced.status === 'timeout') return fallback(conversationId, 'timeout')
    if (raced.status === 'error') return fallback(conversationId, 'error')

    const parsed = parseToolPlan(raced.value.text)
    if (!parsed.ok) return fallback(conversationId, 'malformed')
    if (parsed.plan.calls.length === 0) return fallback(conversationId, 'empty')

    const result = executePlan(parsed.plan, registry)
    if (!result) return fallback(conversationId, 'unsupported')

    emit(conversationId, { path: 'llm', reason: null })
    return result
  }
}
