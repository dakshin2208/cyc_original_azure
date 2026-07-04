/**
 * @module lib/ai/llm/providers/openai/config
 *
 * Reads the OpenAI (or OpenAI-compatible) client configuration from environment
 * variables. The API key is NEVER hardcoded — it is read from `OPENAI_API_KEY`.
 * When the key is absent, `readOpenAiConfig` returns `null` so the caller can fall
 * back to the deterministic path (no accidental network call). It supports both
 * public OpenAI (`OPENAI_BASE_URL`, Bearer auth) and NATIVE Azure OpenAI
 * (`AZURE_OPENAI_ENDPOINT` + `OPENAI_API_VERSION`, api-key auth, deployment in the
 * URL). The provider reads the resolved `isAzure` flag. No AI logic here.
 */

/** Resolved OpenAI client configuration. */
export interface OpenAiConfig {
  /** Secret API key (from `OPENAI_API_KEY`). Never logged. */
  readonly apiKey: string
  /** Model id (default `gpt-4o-mini`; override with `OPENAI_MODEL`). */
  readonly model: string
  /** Base URL (default OpenAI; override with `OPENAI_BASE_URL` / `AZURE_OPENAI_ENDPOINT`). */
  readonly baseUrl: string
  /** True when targeting a NATIVE Azure OpenAI resource (api-key auth + api-version). */
  readonly isAzure: boolean
  /** Azure REST api-version (`OPENAI_API_VERSION`; used in Azure mode only). */
  readonly apiVersion: string
  /** Per-request timeout in ms (`OPENAI_TIMEOUT_MS`, default 30000). */
  readonly timeoutMs: number
  /** Max output tokens (`OPENAI_MAX_OUTPUT_TOKENS`, default 1024). */
  readonly maxOutputTokens: number
  /** Sampling temperature — 0 for grounded, near-deterministic reasoning. */
  readonly temperature: number
  /** Retry attempts for transient (429/5xx/network/timeout) failures. */
  readonly maxRetries: number
  /** Base backoff delay (ms) between retries (exponential). */
  readonly retryBaseDelayMs: number
}

/** The environment variable names this module reads. */
export const OPENAI_ENV_VARS = {
  apiKey: 'OPENAI_API_KEY',
  model: 'OPENAI_MODEL',
  baseUrl: 'OPENAI_BASE_URL',
  timeoutMs: 'OPENAI_TIMEOUT_MS',
  maxOutputTokens: 'OPENAI_MAX_OUTPUT_TOKENS',
  azureEndpoint: 'AZURE_OPENAI_ENDPOINT',
  apiVersion: 'OPENAI_API_VERSION',
} as const

/** Default Azure OpenAI REST api-version when `OPENAI_API_VERSION` is unset. */
const DEFAULT_AZURE_API_VERSION = '2024-10-21'

type Env = Record<string, string | undefined>

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * Read the OpenAI config from `env`, or `null` when `OPENAI_API_KEY` is not set.
 */
export function readOpenAiConfig(env: Env): OpenAiConfig | null {
  const apiKey = env[OPENAI_ENV_VARS.apiKey]?.trim()
  if (!apiKey) return null

  // Native Azure OpenAI is selected by an explicit endpoint, or a base URL that
  // points at the azure host. It needs api-key auth + an api-version (see provider).
  const azureEndpoint = env[OPENAI_ENV_VARS.azureEndpoint]?.trim()
  const explicitBase = env[OPENAI_ENV_VARS.baseUrl]?.trim()
  const isAzure = Boolean(azureEndpoint) || (explicitBase?.includes('.openai.azure.com') ?? false)
  const baseUrl = (azureEndpoint || explicitBase || 'https://api.openai.com/v1').replace(/\/+$/, '')

  return {
    apiKey,
    model: env[OPENAI_ENV_VARS.model]?.trim() || 'gpt-4o-mini',
    baseUrl,
    isAzure,
    apiVersion: env[OPENAI_ENV_VARS.apiVersion]?.trim() || DEFAULT_AZURE_API_VERSION,
    timeoutMs: positiveInt(env[OPENAI_ENV_VARS.timeoutMs], 30_000),
    maxOutputTokens: positiveInt(env[OPENAI_ENV_VARS.maxOutputTokens], 1024),
    temperature: 0,
    maxRetries: 2,
    retryBaseDelayMs: 500,
  }
}
