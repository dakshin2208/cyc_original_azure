/**
 * @module lib/ai/providers/null-providers
 *
 * Null Object implementations of the LLM/SQL/Vector ports used when no provider
 * is wired (`provider: 'none'`). They satisfy the port contracts so the
 * container is always complete, but **fail fast** with a typed {@link ConfigError}
 * the moment they are actually used — far safer than a binding that silently
 * returns fabricated data. These are real defensive objects, not placeholders.
 *
 * Concrete provider adapters (Anthropic, Supabase, a vector store) are delivered
 * by later modules and registered via the {@link ProviderRegistry}.
 */

import {
  ConfigError,
  type LlmPort,
  type LlmResult,
  type LlmStreamChunk,
  type QueryResult,
  type SqlPort,
  type VectorIndexPort,
  type VectorMatch,
} from '@/lib/ai/shared'

function notConfigured(kind: string, envVar: string): ConfigError {
  return new ConfigError(
    `${kind} provider is not configured. Set ${envVar} and register a provider adapter before use.`,
    {
      safeMessage: 'This capability is not available yet.',
      detail: { kind, envVar },
    },
  )
}

/** An {@link LlmPort} that throws on any use. */
export class NullLlmProvider implements LlmPort {
  async complete(): Promise<LlmResult> {
    throw notConfigured('LLM', 'AI_LLM_PROVIDER')
  }

  // A generator with no `yield` is intentional: it throws before producing any chunk.
  async *stream(): AsyncIterable<LlmStreamChunk> {
    throw notConfigured('LLM', 'AI_LLM_PROVIDER')
  }
}

/** A {@link SqlPort} that throws on any use. */
export class NullSqlProvider implements SqlPort {
  async run<Row = Readonly<Record<string, unknown>>>(): Promise<QueryResult<Row>> {
    throw notConfigured('SQL', 'AI_SQL_PROVIDER')
  }
}

/** A {@link VectorIndexPort} that throws on any use. */
export class NullVectorProvider implements VectorIndexPort {
  async search(): Promise<readonly VectorMatch[]> {
    throw notConfigured('Vector', 'AI_VECTOR_PROVIDER')
  }

  async upsert(): Promise<void> {
    throw notConfigured('Vector', 'AI_VECTOR_PROVIDER')
  }
}
