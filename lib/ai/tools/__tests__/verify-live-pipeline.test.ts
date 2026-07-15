/**
 * @module lib/ai/tools/__tests__/verify-live-pipeline
 *
 * LIVE production-pipeline verification (opt-in). Drives the REAL new LLM
 * orchestration path — real Azure OpenAI provider + real warehouse — for each
 * scenario and prints every stage: user input → LLM understand output → tool
 * selected → tool arguments → tool result → writer grounding → final response,
 * plus the orchestration path (llm vs deterministic_fallback).
 *
 * Gated: runs only when the env is configured (Azure key + warehouse). Self-loads
 * `.env.local` so it needs nothing in process.env.
 */

import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { resolveConfiguredProvider } from '@/lib/ai/llm'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import {
  createDefaultToolRegistry,
  executePlan,
  parseToolPlan,
  planMessages,
  type OrchestrationOutcome,
} from '@/lib/ai/tools'
import { buildCounselorChatService, type ChatResponse } from '@/lib/ai/chat'

/** Parse .env.local (tolerant of dotenv's leading-whitespace keys). */
function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  let raw = ''
  try {
    raw = readFileSync('.env.local', 'utf8')
  } catch {
    return out
  }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return out
}

const env = loadEnvLocal()
const configured = Boolean(env.OPENAI_API_KEY && env.CYC_DATA_DIR)

interface Scenario {
  readonly name: string
  readonly input: string
}
const SCENARIOS: readonly Scenario[] = [
  { name: 'Recommendation by cutoff', input: 'My cutoff is 178 and I am BC community. Which colleges can I get?' },
  { name: 'Missing community', input: 'My cutoff is 150. Which colleges can I get in Coimbatore?' },
  { name: 'College comparison', input: 'Compare PSG College of Technology and Kumaraguru College of Technology' },
  { name: 'Placement query', input: 'Which colleges have the best placements?' },
  { name: 'College details', input: 'What can you tell me about PSG College of Technology?' },
  { name: 'Branch guidance', input: 'Which engineering branch has the best future?' },
  { name: 'Invalid college', input: 'What can you tell me about Nonexistent Institute of Nowhere?' },
  { name: 'General conversation', input: 'Hello' },
]

interface Report {
  name: string
  input: string
  understand: string
  toolSelected: string
  toolArgs: string
  toolResult: string
  path: string
  grounding: string
  response: string
  status: number
  ok: boolean
}
const reports: Report[] = []

describe.skipIf(!configured)('LIVE production pipeline verification', () => {
  it('runs all scenarios through the real new LLM orchestration path', async () => {
    // 1. Build real components.
    const provider = resolveConfiguredProvider(env)
    // 2. Confirm the new LLM orchestration path is ACTIVE (a real provider, not "none").
    expect(provider.name, 'expected a live Azure/OpenAI provider — the new path would be inactive otherwise').not.toBe('none')

    const repos = createRepositories(buildWarehouseFromDirectory(env.CYC_DATA_DIR as string))
    const retrieval = createRetrievalEngine(repos)
    const registry = createDefaultToolRegistry()

    const orchestrationEvents = new Map<string, OrchestrationOutcome>()
    const service = buildCounselorChatService({
      env,
      dataDir: env.CYC_DATA_DIR,
      analytics: {
        track: (e) => {
          if (e.type === 'orchestration') orchestrationEvents.set(e.conversationId, { path: e.path, reason: e.fallbackReason })
        },
      },
    })

    for (let i = 0; i < SCENARIOS.length; i++) {
      const s = SCENARIOS[i]
      const convId = `verify-${i}`

      // ── Stage 1: LLM Understand (raw output from Azure) ──────────────────────
      let understandText = ''
      try {
        understandText = (await provider.complete({ messages: planMessages(s.input), responseFormat: 'json', temperature: 0 })).text.trim()
      } catch (e) {
        understandText = `<provider error: ${(e as Error).message}>`
      }

      // ── Stage 2: Parse tool plan → tool + arguments ──────────────────────────
      const parsed = parseToolPlan(understandText)
      const firstCall = parsed.ok ? parsed.plan.calls[0] : undefined
      const toolSelected = parsed.ok ? (parsed.plan.calls.length === 0 ? '(empty plan → fallback)' : firstCall?.tool ?? '?') : `(malformed → fallback)`
      const toolArgs = firstCall ? JSON.stringify(firstCall.arguments) : '—'

      // ── Stage 3: Execute the plan through the registry → neutral tool result ──
      const toolResult = parsed.ok ? executePlan(parsed.plan, registry) : null

      // ── Stage 4: Full pipeline → writer → final response ─────────────────────
      const outcome = await service.handle({ message: s.input, conversationId: convId })
      const body = outcome.body as ChatResponse
      const orchestration = orchestrationEvents.get(convId)
      const grounding = `${body.citations?.length ?? 0} evidence citation(s)` + (body.citations?.length ? `: ${body.citations.slice(0, 3).map((c) => c.evidenceId).join(', ')}${body.citations.length > 3 ? ' …' : ''}` : '')

      const path = orchestration ? `${orchestration.path}${orchestration.reason ? ` (${orchestration.reason})` : ''}` : '(deterministic — understand not consulted: non-question turn)'

      reports.push({
        name: s.name,
        input: s.input,
        understand: understandText,
        toolSelected,
        toolArgs,
        toolResult: toolResult ? JSON.stringify(toolResult) : 'null (→ deterministic fallback)',
        path,
        grounding,
        response: (body.answer ?? '').replace(/\s+/g, ' ').trim(),
        status: outcome.httpStatus,
        ok: outcome.httpStatus === 200 && (body.answer ?? '').length > 0,
      })

      // Every scenario must produce a valid, non-empty 200 response through the pipeline.
      expect(outcome.httpStatus, `${s.name} returned non-200`).toBe(200)
      expect((body.answer ?? '').length, `${s.name} returned an empty answer`).toBeGreaterThan(0)
    }
  }, 180_000)

  afterAll(() => {
    const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
    const blocks = reports.map(
      (r) =>
        `\n──────────────────────────────────────────────────────────────────────\n` +
        `SCENARIO       : ${r.name}   [${r.ok ? 'PASS' : 'FAIL'}  HTTP ${r.status}]\n` +
        `User input     : ${r.input}\n` +
        `LLM Understand : ${trunc(r.understand, 300)}\n` +
        `Tool selected  : ${r.toolSelected}\n` +
        `Tool arguments : ${r.toolArgs}\n` +
        `Tool result    : ${r.toolResult}\n` +
        `Orchestration  : ${r.path}\n` +
        `Writer grounding: ${r.grounding}\n` +
        `Final response : ${trunc(r.response, 500)}`,
    )
    const pass = reports.filter((r) => r.ok).length
    // eslint-disable-next-line no-console
    console.log(
      `\n\n================= LIVE PIPELINE VERIFICATION (${pass}/${reports.length} scenarios OK) =================` +
        blocks.join('') +
        `\n──────────────────────────────────────────────────────────────────────\n`,
    )
  })
})

// Visibility when skipped (so a missing-config run is obvious, not silently green).
describe.skipIf(configured)('LIVE production pipeline verification (skipped)', () => {
  it('is skipped because Azure key / warehouse are not configured in .env.local', () => {
    expect(configured).toBe(false)
  })
})
