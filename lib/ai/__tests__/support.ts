/**
 * @module lib/ai/__tests__/support
 *
 * Shared test doubles and helpers for the Configuration & DI test suite. These
 * are test-only fakes (deterministic clock, capturing log sink, in-memory ports)
 * that let tests exercise wiring without real infrastructure. Excluded from the
 * production build.
 */

import type {
  AuthContext,
  ClockPort,
  LlmPort,
  LlmResult,
  PlanType,
  QueryResult,
  SqlPort,
  TelemetryPort,
  VectorIndexPort,
  VectorMatch,
} from '@/lib/ai/shared'
import type { EnvSource } from '@/lib/ai/config'
import { NoopTelemetry } from '@/lib/ai/adapters'

/** A deterministic clock frozen at a fixed instant. */
export class FakeClock implements ClockPort {
  constructor(private readonly fixed: Date = new Date('2026-01-01T00:00:00.000Z')) {}
  now(): Date {
    return this.fixed
  }
  isoNow(): string {
    return this.fixed.toISOString()
  }
}

/** A log sink that captures every emitted line for assertions. */
export function capturingSink(): { sink: (line: string) => void; lines: string[] } {
  const lines: string[] = []
  return { sink: (line: string) => lines.push(line), lines }
}

/** Build a minimal, valid environment for `loadAiConfig` with overrides. */
export function testEnv(overrides: Record<string, string | undefined> = {}): EnvSource {
  return { ...overrides }
}

/** Build an `AuthContext` for tests. */
export function testAuth(plan: PlanType = 'freemium'): AuthContext {
  return { userId: null, isAuthenticated: false, plan, roles: [] }
}

/** A no-op telemetry adapter for override injection. */
export function fakeTelemetry(): TelemetryPort {
  return new NoopTelemetry()
}

/** A fake LLM port returning a fixed result (used for override tests). */
export class FakeLlm implements LlmPort {
  async complete(): Promise<LlmResult> {
    return { text: 'fake', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0 } }
  }
  async *stream(): AsyncIterable<{ delta: string; done: boolean }> {
    yield { delta: 'fake', done: true }
  }
}

/** A fake SQL port returning empty rows (used for override tests). */
export class FakeSql implements SqlPort {
  async run<Row = Readonly<Record<string, unknown>>>(): Promise<QueryResult<Row>> {
    return { rows: [], source: { kind: 'sql', name: 'fake' } }
  }
}

/** A fake vector port returning no matches (used for override tests). */
export class FakeVector implements VectorIndexPort {
  async search(): Promise<readonly VectorMatch[]> {
    return []
  }
  async upsert(): Promise<void> {
    // no-op
  }
}
