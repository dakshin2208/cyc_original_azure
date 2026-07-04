/**
 * @module lib/ai/llm/adapter
 *
 * The LLM Adapter — the heart of the integration layer. Given a Sprint 4
 * {@link PromptPackage} + {@link ContextPackage}, it: calls the injected provider →
 * parses the completion → structurally validates it → runs the hallucination
 * guard → and returns a guaranteed-safe {@link LLMResult}. On a parse failure,
 * rejection, or provider error it retries ONCE (with a corrective nudge) and,
 * failing that, returns a DETERMINISTIC fallback built from the context. It never
 * throws, never streams, and never calls an LLM itself beyond the provider seam.
 */

import type { AIResponse, ContextPackage, PromptPackage } from '@/lib/ai/orchestration'
import { toCompletionRequest, type CompletionRequest } from './message'
import { parseAIResponse } from './parser'
import type { LLMProvider } from './provider'
import type { LLMResponseStatus, LLMResult, ResponseIssue } from './response'
import { applyHallucinationGuard, buildGrounding, validateResponse } from './validator'

/** Adapter behaviour knobs (nothing hardcoded downstream). */
export interface AdapterConfig {
  /** Total provider attempts, including the first (default 2 = one retry). */
  readonly maxAttempts: number
  /** Sampling temperature passed to the provider (default 0). */
  readonly temperature: number
  /** Text substituted for unsupported sentences / empty answers. */
  readonly insufficientEvidenceText: string
  /** Corrective message appended on retry attempts. */
  readonly retryReminder: string
}

/** The default adapter configuration. */
export const defaultAdapterConfig: AdapterConfig = {
  maxAttempts: 2,
  temperature: 0,
  insufficientEvidenceText: "I don't have sufficient evidence.",
  retryReminder:
    'Your previous reply was invalid. Respond with ONLY the JSON object described, ' +
    'using strictly the supplied EVIDENCE. Do not invent colleges, cutoffs, placements, or fees.',
}

/** Resolve a partial config onto the defaults. */
export function resolveAdapterConfig(override?: Partial<AdapterConfig>): AdapterConfig {
  return { ...defaultAdapterConfig, ...override }
}

/** The public adapter API. */
export interface LLMAdapter {
  readonly provider: string
  /** Turn a prompt + its context into a safe, validated final response. */
  respond(prompt: PromptPackage, context: ContextPackage): Promise<LLMResult>
}

type FailureKind = 'provider' | 'parse' | 'validation'

/** Build a deterministic, non-fabricating fallback answer from the context. */
function buildFallback(context: ContextPackage, config: AdapterConfig): AIResponse {
  const followUps = context.followUpQuestions
  const answer =
    followUps.length > 0
      ? `I don't have enough information to answer confidently yet. ${followUps.map((f) => f.question).join(' ')}`
      : config.insufficientEvidenceText
  return {
    answer,
    citations: [],
    followUps,
    confidence: 'low',
    hadMissingInformation: context.missingInformation.length > 0,
  }
}

const FAILURE_STATUS: Readonly<Record<FailureKind, LLMResponseStatus>> = {
  provider: 'provider_error',
  parse: 'unparseable',
  validation: 'rejected',
}

/** Create an LLM adapter over an injected provider. */
export function createLLMAdapter(provider: LLMProvider, override?: Partial<AdapterConfig>): LLMAdapter {
  const config = resolveAdapterConfig(override)
  const maxAttempts = Math.max(1, config.maxAttempts)

  const requestFor = (base: CompletionRequest, attempt: number): CompletionRequest =>
    attempt === 1
      ? base
      : { ...base, messages: [...base.messages, { role: 'user', content: config.retryReminder }] }

  const respond = async (prompt: PromptPackage, context: ContextPackage): Promise<LLMResult> => {
    const grounding = buildGrounding(context)
    const base = toCompletionRequest(prompt, { temperature: config.temperature })
    const issues: ResponseIssue[] = []
    let lastRaw: string | null = null
    let lastFailure: FailureKind = 'provider'

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let text: string
      try {
        text = (await provider.complete(requestFor(base, attempt))).text
      } catch (e) {
        lastFailure = 'provider'
        issues.push({ code: 'provider_error', message: (e as Error).message, severity: 'error' })
        continue
      }
      lastRaw = text

      const parsed = parseAIResponse(text)
      if (!parsed.ok) {
        lastFailure = 'parse'
        issues.push({ code: 'parse_error', message: parsed.error, severity: 'error' })
        continue
      }

      const validation = validateResponse(parsed.value, grounding)
      if (!validation.ok) {
        lastFailure = 'validation'
        issues.push(...validation.issues)
        continue
      }

      const guarded = applyHallucinationGuard(parsed.value, grounding, config.insufficientEvidenceText)
      return {
        status: guarded.removed.length > 0 ? 'repaired' : 'ok',
        response: guarded.response,
        issues: [...issues, ...guarded.issues],
        attempts: attempt,
        raw: lastRaw,
        provider: provider.name,
      }
    }

    // All attempts exhausted → deterministic, non-fabricating fallback.
    return {
      status: FAILURE_STATUS[lastFailure],
      response: buildFallback(context, config),
      issues,
      attempts: maxAttempts,
      raw: lastRaw,
      provider: provider.name,
    }
  }

  return Object.freeze({ provider: provider.name, respond })
}
