/**
 * @module lib/ai/config/env
 *
 * Environment reading and parsing primitives. This is the **only** module in the
 * AI platform permitted to read `process.env` (via the default parameter of
 * {@link loadAiConfig}); everywhere else, configuration is injected
 * (Project Structure, doc 07 §14).
 *
 * {@link EnvReader} accumulates *all* validation problems and reports them
 * together via a single {@link ConfigError}, so a misconfigured deployment fails
 * fast with a complete list rather than one error at a time.
 */

import { ConfigError } from '@/lib/ai/shared'

/** An immutable source of environment values (defaults to `process.env`). */
export type EnvSource = Readonly<Record<string, string | undefined>>

/** Options for reading a string variable. */
interface StringOptions {
  /** Whether the variable must be present and non-empty. */
  readonly required?: boolean
  /** Fallback used when the variable is absent (implies not required). */
  readonly fallback?: string
}

/**
 * Reads and validates values from an {@link EnvSource}, accumulating problems.
 * Call {@link EnvReader.done} after all reads to fail fast on any accumulated
 * issue.
 */
export class EnvReader {
  private readonly issues: string[] = []

  constructor(private readonly env: EnvSource) {}

  /** Raw, trimmed value for `key`, or `undefined` when absent/blank. */
  private raw(key: string): string | undefined {
    const value = this.env[key]
    if (value === undefined) return undefined
    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  }

  /**
   * Read a string variable.
   * @returns the value, the fallback, or `null` when absent and not required.
   */
  string(key: string, options: StringOptions = {}): string | null {
    const value = this.raw(key)
    if (value !== undefined) return value
    if (options.fallback !== undefined) return options.fallback
    if (options.required) this.issues.push(`Missing required environment variable: ${key}`)
    return null
  }

  /**
   * Read a variable that is required only when `condition` holds (e.g. a secret
   * required when its provider is selected).
   */
  requiredWhen(condition: boolean, key: string): string | null {
    const value = this.raw(key)
    if (value !== undefined) return value
    if (condition) {
      this.issues.push(`Missing required environment variable: ${key}`)
    }
    return null
  }

  /** Read a boolean (`true/false/1/0/yes/no`, case-insensitive) with a default. */
  bool(key: string, fallback: boolean): boolean {
    const value = this.raw(key)
    if (value === undefined) return fallback
    const normalized = value.toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
    this.issues.push(`Invalid boolean for ${key}: "${value}" (expected true/false)`)
    return fallback
  }

  /** Read a positive integer with a default. */
  int(key: string, fallback: number): number {
    const value = this.raw(key)
    if (value === undefined) return fallback
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      this.issues.push(`Invalid integer for ${key}: "${value}" (expected a non-negative integer)`)
      return fallback
    }
    return parsed
  }

  /** Read a value constrained to a fixed set of allowed literals, with a default. */
  enum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const value = this.raw(key)
    if (value === undefined) return fallback
    if ((allowed as readonly string[]).includes(value)) return value as T
    this.issues.push(
      `Invalid value for ${key}: "${value}" (expected one of: ${allowed.join(', ')})`,
    )
    return fallback
  }

  /**
   * Throw an aggregated {@link ConfigError} if any problems were accumulated.
   * Call exactly once, after all reads.
   */
  done(): void {
    if (this.issues.length > 0) {
      throw new ConfigError(
        `AI configuration is invalid: ${this.issues.length} problem(s) found.`,
        {
          safeMessage: 'The AI service is misconfigured. Please contact support.',
          detail: { issues: [...this.issues] },
        },
      )
    }
  }
}
