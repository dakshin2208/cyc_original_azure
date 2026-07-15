/**
 * @module lib/ai/tools/tool-request
 *
 * Deliverable 2 — the Tool Request JSON schema + its deterministic parser.
 *
 * The understanding LLM returns a JSON object describing the tool to call. This
 * module defines that contract and validates/coerces the raw model text into a
 * typed {@link ToolRequest}. It reuses the existing writer-layer JSON extractor
 * ({@link extractJsonObject}) and the knowledge-layer community normalizer
 * ({@link normalizeCommunity}) — no parsing logic is duplicated. Pure; no I/O.
 */

import { extractJsonObject } from '@/lib/ai/llm'
import { normalizeCommunity, type CommunityCode } from '@/lib/knowledge'

/** The tools the prototype can dispatch (one, for Commit 1). */
export const TOOL_NAMES = ['recommend_by_cutoff'] as const
export type ToolName = (typeof TOOL_NAMES)[number]

/** Validated arguments for `recommend_by_cutoff` (canonical types the engine consumes). */
export interface RecommendByCutoffArgs {
  readonly cutoff: number
  readonly community: CommunityCode
  readonly district: string | null
  readonly branch: string | null
  readonly limit: number | null
}

/** A validated tool request ready to hand to the recommendation engine. */
export interface ToolRequest {
  readonly tool: 'recommend_by_cutoff'
  readonly arguments: RecommendByCutoffArgs
}

/** The outcome of parsing raw model text into a tool request. */
export type ParseToolResult =
  | { readonly ok: true; readonly request: ToolRequest }
  | { readonly ok: false; readonly error: string }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const asFiniteNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

const asTrimmedString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/**
 * Parse + validate the understanding LLM's JSON into a typed {@link ToolRequest}.
 * Tolerates fenced ```json blocks and stringified numbers; rejects unknown tools,
 * a missing cutoff, and an unrecognised community (the phantom guard for args).
 */
export function parseToolRequest(rawText: string): ParseToolResult {
  const json = extractJsonObject(rawText)
  if (json === null) return { ok: false, error: 'no JSON object found in the model output' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: `tool request was not valid JSON: ${(e as Error).message}` }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'tool request must be a JSON object' }

  if (parsed.tool !== 'recommend_by_cutoff') {
    return { ok: false, error: `unknown or unsupported tool: ${String(parsed.tool)}` }
  }
  const args = parsed.arguments
  if (!isRecord(args)) return { ok: false, error: 'tool "arguments" must be a JSON object' }

  const cutoff = asFiniteNumber(args.cutoff)
  if (cutoff === null) return { ok: false, error: 'argument "cutoff" must be a number' }

  const communityRaw = asTrimmedString(args.community)
  const community = communityRaw ? normalizeCommunity(communityRaw) : null
  if (community === null) {
    return { ok: false, error: 'argument "community" is missing or not a recognised community' }
  }

  return {
    ok: true,
    request: {
      tool: 'recommend_by_cutoff',
      arguments: {
        cutoff,
        community,
        district: asTrimmedString(args.district),
        branch: asTrimmedString(args.branch),
        limit: asFiniteNumber(args.limit),
      },
    },
  }
}
