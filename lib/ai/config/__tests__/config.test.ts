/**
 * Configuration loading & validation tests: defaults, missing env, invalid env,
 * conditional provider secrets, feature flags, and the safe ConfigPort subset.
 */

import { describe, expect, it } from 'vitest'
import { ConfigError } from '@/lib/ai/shared'
import { createConfigProvider, loadAiConfig } from '@/lib/ai/config'
import { testEnv } from '@/lib/ai/__tests__/support'

/** Extract the aggregated issue list from a thrown ConfigError. */
function issuesOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError)
    return ((error as ConfigError).detail as { issues: string[] }).issues
  }
  throw new Error('expected loadAiConfig to throw')
}

describe('loadAiConfig — defaults', () => {
  it('applies safe production defaults for an empty environment', () => {
    const config = loadAiConfig(testEnv())

    expect(config.llm.provider).toBe('none')
    expect(config.supabase.provider).toBe('none')
    expect(config.vectorDb.provider).toBe('none')
    expect(config.defaultModelTier).toBe('balanced')
    expect(config.maxCandidateSet).toBe(500)
    expect(config.logging.level).toBe('info')
    expect(config.telemetry.enabled).toBe(false)
  })

  it('defaults flags to the documented wave-rollout values', () => {
    const { flags } = loadAiConfig(testEnv())
    expect(flags).toEqual({
      ragEnabled: false,
      recommendationEnabled: true,
      comparisonEnabled: true,
      memoryEnabled: false,
      telemetryEnabled: false,
      reasoningEnabled: true,
      streamingEnabled: true,
    })
  })

  it('returns frozen, immutable configuration', () => {
    const config = loadAiConfig(testEnv())
    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.flags)).toBe(true)
  })
})

describe('loadAiConfig — missing environment', () => {
  it('requires the Anthropic key only when Anthropic is selected', () => {
    const issues = issuesOf(() => loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'anthropic' })))
    expect(issues).toContain('Missing required environment variable: ANTHROPIC_API_KEY')
  })

  it('requires all Supabase settings when the SQL provider is supabase', () => {
    const issues = issuesOf(() => loadAiConfig(testEnv({ AI_SQL_PROVIDER: 'supabase' })))
    expect(issues).toEqual(
      expect.arrayContaining([
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL',
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
      ]),
    )
  })

  it('aggregates every problem into a single ConfigError', () => {
    const issues = issuesOf(() =>
      loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'anthropic', AI_SQL_PROVIDER: 'supabase' })),
    )
    expect(issues.length).toBeGreaterThan(1)
  })
})

describe('loadAiConfig — invalid environment', () => {
  it('rejects an unknown provider value', () => {
    const issues = issuesOf(() => loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'bogus' })))
    expect(issues.some((i) => i.includes('AI_LLM_PROVIDER'))).toBe(true)
  })

  it('rejects a non-boolean flag value', () => {
    const issues = issuesOf(() => loadAiConfig(testEnv({ AI_FLAG_RAG_ENABLED: 'maybe' })))
    expect(issues.some((i) => i.includes('AI_FLAG_RAG_ENABLED'))).toBe(true)
  })

  it('rejects a non-integer candidate-set size', () => {
    const issues = issuesOf(() => loadAiConfig(testEnv({ AI_MAX_CANDIDATE_SET: 'lots' })))
    expect(issues.some((i) => i.includes('AI_MAX_CANDIDATE_SET'))).toBe(true)
  })
})

describe('loadAiConfig — provider selection & secrets', () => {
  it('loads Anthropic configuration when the key is present', () => {
    const config = loadAiConfig(testEnv({ AI_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }))
    expect(config.llm.provider).toBe('anthropic')
    expect(config.llm.anthropicApiKey).toBe('sk-test')
  })

  it('couples the telemetry flag to telemetry configuration', () => {
    const config = loadAiConfig(testEnv({ AI_TELEMETRY_ENABLED: 'true' }))
    expect(config.telemetry.enabled).toBe(true)
    expect(config.flags.telemetryEnabled).toBe(true)
  })

  it('parses feature flags from the environment', () => {
    const config = loadAiConfig(
      testEnv({ AI_FLAG_RAG_ENABLED: 'true', AI_FLAG_STREAMING_ENABLED: 'false' }),
    )
    expect(config.flags.ragEnabled).toBe(true)
    expect(config.flags.streamingEnabled).toBe(false)
  })
})

describe('createConfigProvider — safe subset only', () => {
  it('exposes flags, tier, and candidate cap — and no secrets', () => {
    const platform = loadAiConfig(
      testEnv({ AI_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-secret' }),
    )
    const port = createConfigProvider(platform)
    const safe = port.get()

    expect(Object.keys(safe).sort()).toEqual(['defaultModelTier', 'flags', 'maxCandidateSet'])
    expect(JSON.stringify(safe)).not.toContain('sk-secret')
    expect(port.flags().ragEnabled).toBe(false)
  })
})
