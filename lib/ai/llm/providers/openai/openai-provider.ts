/**
 * @module lib/ai/llm/providers/openai/openai-provider
 *
 * A production OpenAI (Chat Completions) client that implements the Sprint-5
 * {@link LLMProvider} interface — a THIN transport with no business logic. It maps
 * the neutral {@link CompletionRequest} to the OpenAI API, enforces a per-request
 * timeout (AbortController), retries transient failures (429/5xx/network/timeout)
 * with exponential backoff, maps errors to {@link ProviderError}, and returns token
 * usage. It hardcodes NO key (config carries it) and never parses/validates the
 * model output — that is the adapter's job. `fetch` is injectable for tests.
 */

import type { CompletionRequest, CompletionResult, TokenUsage } from '../../message'
import type { LLMProvider } from '../../provider'
import { ProviderError } from '../../errors'
import type { OpenAiConfig } from './config'

/** The subset of the OpenAI Chat Completions response we consume. */
interface OpenAiChatResponse {
  readonly model?: string
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null }
    readonly finish_reason?: string
  }>
  readonly usage?: {
    readonly prompt_tokens?: number
    readonly completion_tokens?: number
    readonly total_tokens?: number
  }
}

/** Injectable dependencies (tests). */
export interface OpenAiProviderDeps {
  readonly fetchImpl?: typeof fetch
  readonly sleep?: (ms: number) => Promise<void>
}

const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500

function toUsage(u: OpenAiChatResponse['usage']): TokenUsage | undefined {
  if (!u) return undefined
  return { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens }
}

/** Create an OpenAI-backed provider from a resolved config. */
export function createOpenAiProvider(config: OpenAiConfig, deps: OpenAiProviderDeps = {}): LLMProvider {
  const name = 'openai'
  const doFetch = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  const callOnce = async (request: CompletionRequest): Promise<CompletionResult> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)
    let response: Response
    try {
      // Azure OpenAI puts the deployment in the URL + an api-version query param and
      // authenticates with an `api-key` header; public OpenAI uses a fixed path,
      // `Authorization: Bearer`, and the model in the body. Body is identical.
      const url = config.isAzure
        ? `${config.baseUrl}/openai/deployments/${request.model ?? config.model}/chat/completions?api-version=${config.apiVersion}`
        : `${config.baseUrl}/chat/completions`
      const authHeaders: Record<string, string> = config.isAzure
        ? { 'api-key': config.apiKey }
        : { authorization: `Bearer ${config.apiKey}` }
      response = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          model: request.model ?? config.model,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: request.temperature ?? config.temperature,
          max_tokens: request.maxTokens ?? config.maxOutputTokens,
          ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      })
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      throw new ProviderError(
        aborted ? `openai request timed out after ${config.timeoutMs}ms` : `openai request failed`,
        { name, retryable: true },
      )
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      // Body may contain the provider's error detail; keep only a short, safe snippet.
      const snippet = (await response.text().catch(() => '')).slice(0, 200)
      throw new ProviderError(`openai returned HTTP ${response.status}`, {
        name,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        detail: snippet,
      })
    }

    const json = (await response.json().catch(() => null)) as OpenAiChatResponse | null
    const text = json?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new ProviderError('openai returned an empty completion', { name, retryable: true })
    }
    return {
      text,
      model: json?.model,
      finishReason: json?.choices?.[0]?.finish_reason,
      usage: toUsage(json?.usage),
    }
  }

  const complete = async (request: CompletionRequest): Promise<CompletionResult> => {
    let lastError: unknown
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await callOnce(request)
      } catch (e) {
        lastError = e
        const retryable = e instanceof ProviderError && e.detail?.retryable === true
        if (!retryable || attempt === config.maxRetries) throw e
        await sleep(config.retryBaseDelayMs * 2 ** attempt)
      }
    }
    throw lastError instanceof Error ? lastError : new ProviderError('openai request failed', { name })
  }

  return Object.freeze({ name, complete })
}
