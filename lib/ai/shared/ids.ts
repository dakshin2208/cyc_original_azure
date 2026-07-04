/**
 * @module lib/ai/shared/ids
 *
 * Branded (nominal) identifier value objects.
 *
 * TypeScript is structurally typed, so a raw `string` "college code" is
 * assignable anywhere a `string` "nirf id" is expected — a real hazard in this
 * domain, where two independent identifier systems coexist (`nirf_id` for NIRF
 * institutions vs `counselling_code` for TNEA admission units; Knowledge Audit,
 * doc 01 §0). Branding makes these mutually non-assignable at compile time.
 *
 * Each id has a smart constructor that trims and validates the input, so
 * illegal states (empty ids) are unrepresentable once constructed. Constructors
 * throw {@link ValidationError} on invalid input.
 */

import { ValidationError } from './errors'

/** Unique brand marker — exists only in the type system and is fully erased. */
declare const brand: unique symbol

/**
 * Attaches a compile-time-only nominal brand `B` to a base type `T`.
 * @typeParam T Underlying runtime type (always `string` here).
 * @typeParam B Unique brand label.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B }

/** Authenticated end-user identifier (Supabase auth uid). */
export type UserId = Brand<string, 'UserId'>
/** Conversation/session identifier. */
export type SessionId = Brand<string, 'SessionId'>
/** Single-turn identifier within a session. */
export type TurnId = Brand<string, 'TurnId'>
/** Correlation id spanning all work for one turn (logs, spans). */
export type TraceId = Brand<string, 'TraceId'>
/** NIRF institution identifier, e.g. `IR-E-C-16614` (links the `nirf_*` tables). */
export type NirfId = Brand<string, 'NirfId'>
/** TNEA counselling code, e.g. `1101` (links the `tnea_*` tables). */
export type CounsellingCode = Brand<string, 'CounsellingCode'>
/** Product-level college code as used by the L1 `colleges`/`Cutoff` tables. */
export type CollegeCode = Brand<string, 'CollegeCode'>

/**
 * Trim and require a non-empty string, or throw {@link ValidationError}.
 * Shared by every string-id constructor.
 */
function requireNonEmpty(value: string, kind: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${kind} must be a string`, { detail: { kind } })
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError(`${kind} must not be empty`, { detail: { kind } })
  }
  return trimmed
}

/** Construct a validated {@link UserId}. */
export function userId(value: string): UserId {
  return requireNonEmpty(value, 'UserId') as UserId
}

/** Construct a validated {@link SessionId}. */
export function sessionId(value: string): SessionId {
  return requireNonEmpty(value, 'SessionId') as SessionId
}

/** Construct a validated {@link TurnId}. */
export function turnId(value: string): TurnId {
  return requireNonEmpty(value, 'TurnId') as TurnId
}

/** Construct a validated {@link TraceId}. */
export function traceId(value: string): TraceId {
  return requireNonEmpty(value, 'TraceId') as TraceId
}

/** Construct a validated {@link NirfId}. */
export function nirfId(value: string): NirfId {
  return requireNonEmpty(value, 'NirfId') as NirfId
}

/** Construct a validated {@link CounsellingCode}. */
export function counsellingCode(value: string): CounsellingCode {
  return requireNonEmpty(value, 'CounsellingCode') as CounsellingCode
}

/** Construct a validated {@link CollegeCode}. */
export function collegeCode(value: string): CollegeCode {
  return requireNonEmpty(value, 'CollegeCode') as CollegeCode
}
