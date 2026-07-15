/**
 * @module lib/ai/tools/tool
 *
 * The generic Tool contract (Commit 3). Every capability is a {@link Tool} with the
 * same shape — `{ name, description, parameters, execute() }` — registered in the
 * {@link ./registry}. A tool NEVER contains business logic; it maps the LLM's
 * arguments to a NEUTRAL {@link ToolResult} that the coordinator applies by driving
 * the EXISTING pipeline. The coordinator/executor never branch on a tool name.
 *
 * `ToolResult` is deliberately neutral (no dependency on the chat layer's decision
 * types) so `lib/ai/tools` stays free of any `lib/ai/chat` import (no cycle):
 *   • recommend → overlay the profile + run the existing recommend capability
 *   • list      → run the existing directory (listColleges) capability
 *   • route     → rewrite the message; the EXISTING brain routes it (phantom guard reused)
 */

import type { CommunityCode } from '@/lib/knowledge'

/** Profile overrides a `recommend` result carries into the existing pipeline. */
export interface RecommendArgs {
  readonly cutoff?: number
  readonly community?: CommunityCode
  readonly district?: string
  readonly branch?: string
}

/** The neutral routing instruction a tool returns (applied by the coordinator). */
export type ToolResult =
  | { readonly kind: 'recommend'; readonly args: RecommendArgs }
  | { readonly kind: 'list'; readonly city: string; readonly count: number; readonly branch: string | null }
  | { readonly kind: 'route'; readonly message: string; readonly needsCollege: boolean }

/** One callable capability. `execute` is pure: args → routing instruction (or null = decline). */
export interface Tool {
  readonly name: string
  readonly description: string
  /** Lightweight parameter schema: parameter name → human description. */
  readonly parameters: Readonly<Record<string, string>>
  execute(args: Record<string, unknown>): ToolResult | null
}

// ── Shared argument coercers (tolerate stringified numbers / whitespace) ────────
export const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

export const asString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

export const asStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
    : []
