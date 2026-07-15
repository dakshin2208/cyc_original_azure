/**
 * @module lib/ai/tools/tool-plan
 *
 * The Tool Plan schema (Commit 3) — the LLM's understanding output. It is a LIST of
 * tool calls, so the architecture supports multiple tools in one turn:
 *
 *   { "calls": [ { "tool": "recommend_by_cutoff", "arguments": { … } } ] }
 *
 * `parseToolPlan` is GENERIC: it validates the envelope only (a `calls` array of
 * `{ tool: string, arguments: object }`). It knows NO specific tool names and does
 * NO per-tool validation — each {@link ./tool Tool} validates its own arguments.
 * Reuses the writer-layer JSON extractor. Pure; no I/O.
 */

import { extractJsonObject } from '@/lib/ai/llm'

/** One requested tool call. */
export interface ToolCall {
  readonly tool: string
  readonly arguments: Record<string, unknown>
}

/** A plan: an ordered list of tool calls (0..n). */
export interface ToolPlan {
  readonly calls: readonly ToolCall[]
}

export type PlanParseResult =
  | { readonly ok: true; readonly plan: ToolPlan }
  | { readonly ok: false; readonly error: string }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Parse + validate the LLM's JSON into a {@link ToolPlan}. Empty `calls` is valid. */
export function parseToolPlan(rawText: string): PlanParseResult {
  const json = extractJsonObject(rawText)
  if (json === null) return { ok: false, error: 'no JSON object found in the model output' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: `tool plan was not valid JSON: ${(e as Error).message}` }
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.calls)) {
    return { ok: false, error: 'tool plan must be an object with a "calls" array' }
  }

  const calls: ToolCall[] = []
  for (const raw of parsed.calls) {
    if (!isRecord(raw)) continue
    const tool = raw.tool
    if (typeof tool !== 'string' || tool.trim().length === 0) continue
    calls.push({ tool: tool.trim(), arguments: isRecord(raw.arguments) ? raw.arguments : {} })
  }
  return { ok: true, plan: { calls } }
}
