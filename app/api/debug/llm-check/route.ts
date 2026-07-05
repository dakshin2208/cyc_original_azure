/**
 * TEMPORARY diagnostic endpoint — remove after diagnosing the LLM provider.
 *
 * GET /api/debug/llm-check?token=llmdiag-4b8e2c
 *
 * Runs INSIDE the deployed Container App (real production env vars). It reads the
 * OpenAI config exactly like the app does (readOpenAiConfig), reports which env vars
 * are present (never the key value), the resolved config, and the result of a trivial
 * live completion — success text or the exact provider error (status + snippet).
 * Token-gated so it can't be hit anonymously; never returns the API key.
 */

import { NextResponse } from 'next/server'
import { readOpenAiConfig, createOpenAiProvider } from '@/lib/ai/llm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN = 'llmdiag-4b8e2c'

function host(u?: string | null): string | null {
  if (!u) return null
  try {
    return new URL(u).host
  } catch {
    return 'INVALID_URL'
  }
}

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const env = process.env
  const present = {
    OPENAI_API_KEY: env.OPENAI_API_KEY ? `set (len ${env.OPENAI_API_KEY.trim().length})` : 'MISSING',
    OPENAI_MODEL: env.OPENAI_MODEL ?? null,
    AZURE_OPENAI_ENDPOINT_host: host(env.AZURE_OPENAI_ENDPOINT),
    OPENAI_API_VERSION: env.OPENAI_API_VERSION ?? null,
    OPENAI_BASE_URL_host: host(env.OPENAI_BASE_URL),
  }

  const config = readOpenAiConfig(env)
  if (!config) {
    return NextResponse.json({
      step: 'readOpenAiConfig',
      configured: false,
      present,
      note: 'readOpenAiConfig() returned null → OPENAI_API_KEY is not visible to the Node process at runtime (env not injected / wrong name).',
    })
  }

  const resolved = {
    isAzure: config.isAzure,
    baseUrl_host: host(config.baseUrl),
    model_or_deployment: config.model,
    apiVersion: config.apiVersion,
    timeoutMs: config.timeoutMs,
    // The exact URL the provider will POST to (no key) — the single most useful line.
    computedUrl: config.isAzure
      ? `${host(config.baseUrl)}/openai/deployments/${config.model}/chat/completions?api-version=${config.apiVersion}`
      : `${host(config.baseUrl)}/chat/completions`,
  }

  try {
    const provider = createOpenAiProvider(config)
    const res = await provider.complete({ messages: [{ role: 'user', content: 'Say OK.' }], responseFormat: 'text' })
    return NextResponse.json({ step: 'complete', configured: true, ok: true, present, resolved, sample: (res.text ?? '').slice(0, 200), usage: res.usage ?? null })
  } catch (e) {
    const err = e as { name?: string; message?: string; detail?: Record<string, unknown> }
    return NextResponse.json({
      step: 'complete',
      configured: true,
      ok: false,
      present,
      resolved,
      errorName: err?.name ?? null,
      message: String(err?.message ?? e).slice(0, 300),
      status: (err?.detail?.status as number | undefined) ?? null,
      providerDetail: err?.detail?.detail ? String(err.detail.detail).slice(0, 400) : null,
    })
  }
}
