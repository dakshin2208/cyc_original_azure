/**
 * @module lib/ai/llm/providers/openai/__tests__/openai-provider.test
 * OpenAI client — request mapping, success, error mapping, retry, timeout.
 */

import { describe, expect, it, vi } from 'vitest'
import { ProviderError } from '@/lib/ai/llm'
import type { CompletionRequest } from '@/lib/ai/llm'
import { createOpenAiProvider } from '../openai-provider'
import type { OpenAiConfig } from '../config'

const CONFIG: OpenAiConfig = {
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  isAzure: false,
  apiVersion: '2024-10-21',
  timeoutMs: 50,
  maxOutputTokens: 512,
  temperature: 0,
  maxRetries: 2,
  retryBaseDelayMs: 1,
}

const REQUEST: CompletionRequest = {
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
  ],
  responseFormat: 'json',
  temperature: 0,
}

const chatResponse = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ model: 'gpt-4o-mini', choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }),
  text: async () => content,
})
const errorResponse = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => `err ${status}` })
const noSleep = async (): Promise<void> => undefined

describe('openai provider', () => {
  it('maps the request to the OpenAI Chat Completions API and returns text + usage', async () => {
    const fetchImpl = vi.fn(async () => chatResponse('{"answer":"ok"}')) as unknown as typeof fetch
    const provider = createOpenAiProvider(CONFIG, { fetchImpl, sleep: noSleep })
    const result = await provider.complete(REQUEST)

    expect(provider.name).toBe('openai')
    expect(result.text).toBe('{"answer":"ok"}')
    expect(result.usage?.totalTokens).toBe(15)

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(call[1].headers.authorization).toBe('Bearer sk-test')
    const body = JSON.parse(call[1].body)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages).toHaveLength(2)
  })

  it('does not hardcode the key — it comes from config', async () => {
    const fetchImpl = vi.fn(async () => chatResponse('{}')) as unknown as typeof fetch
    await createOpenAiProvider({ ...CONFIG, apiKey: 'sk-other' }, { fetchImpl, sleep: noSleep }).complete(REQUEST)
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.authorization).toBe('Bearer sk-other')
  })

  it('throws ProviderError on a 401 and does NOT retry', async () => {
    const fetchImpl = vi.fn(async () => errorResponse(401))
    const provider = createOpenAiProvider(CONFIG, { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })
    await expect(provider.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(errorResponse(429)).mockResolvedValueOnce(chatResponse('{"answer":"ok"}'))
    const provider = createOpenAiProvider(CONFIG, { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })
    const result = await provider.complete(REQUEST)
    expect(result.text).toBe('{"answer":"ok"}')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('exhausts retries on persistent 500', async () => {
    const fetchImpl = vi.fn(async () => errorResponse(500))
    const provider = createOpenAiProvider(CONFIG, { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })
    await expect(provider.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
    expect(fetchImpl).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })

  it('maps an aborted (timed-out) request to ProviderError', async () => {
    const fetchImpl = ((_url: string, init: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })) as unknown as typeof fetch
    const provider = createOpenAiProvider({ ...CONFIG, timeoutMs: 10, maxRetries: 0 }, { fetchImpl, sleep: noSleep })
    await expect(provider.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
  })

  it('rejects an empty completion', async () => {
    const fetchImpl = vi.fn(async () => chatResponse('   ')) as unknown as typeof fetch
    const provider = createOpenAiProvider({ ...CONFIG, maxRetries: 0 }, { fetchImpl, sleep: noSleep })
    await expect(provider.complete(REQUEST)).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('openai provider — Azure OpenAI mode', () => {
  const AZURE_CONFIG: OpenAiConfig = {
    ...CONFIG,
    isAzure: true,
    baseUrl: 'https://my-res.openai.azure.com',
    apiVersion: '2024-10-21',
    model: 'gpt-4.1', // Azure deployment name
  }

  it('targets the Azure deployment URL and authenticates with api-key (not Bearer)', async () => {
    const fetchImpl = vi.fn(async () => chatResponse('{"answer":"ok"}')) as unknown as typeof fetch
    await createOpenAiProvider(AZURE_CONFIG, { fetchImpl, sleep: noSleep }).complete(REQUEST)

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe(
      'https://my-res.openai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2024-10-21',
    )
    expect(call[1].headers['api-key']).toBe('sk-test')
    expect(call[1].headers.authorization).toBeUndefined() // NEVER Bearer against native Azure
    const body = JSON.parse(call[1].body)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('honors a per-request model override as the Azure deployment', async () => {
    const fetchImpl = vi.fn(async () => chatResponse('{}')) as unknown as typeof fetch
    await createOpenAiProvider(AZURE_CONFIG, { fetchImpl, sleep: noSleep }).complete({ ...REQUEST, model: 'gpt-4o' })
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/deployments/gpt-4o/')
  })
})
