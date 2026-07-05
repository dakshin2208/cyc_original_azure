/**
 * @module lib/ai/shared/result
 *
 * A minimal, immutable Result type for representing operations that can fail
 * without throwing. Internal engine and layer boundaries return `Result<T>` so
 * that *expected* failures are part of the type signature; the Gateway is the
 * single place that converts thrown errors into responses (Project Structure,
 * doc 07 §12).
 *
 * The default error type is {@link AiError}.
 */

import { AiError } from './errors'

/** A successful result carrying a value. */
export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

/** A failed result carrying an error. */
export interface Err<E> {
  readonly ok: false
  readonly error: E
}

/**
 * The outcome of a fallible operation: either {@link Ok} or {@link Err}.
 * @typeParam T Success value type.
 * @typeParam E Failure type (defaults to {@link AiError}).
 */
export type Result<T, E = AiError> = Ok<T> | Err<E>

/** Construct a successful {@link Result}. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/** Construct a failed {@link Result}. */
export function err<E = AiError>(error: E): Err<E> {
  return { ok: false, error }
}

/** Type guard narrowing a {@link Result} to {@link Ok}. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

/** Type guard narrowing a {@link Result} to {@link Err}. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}

/**
 * Transform the success value of a {@link Result}, leaving failures untouched.
 * @param result The input result.
 * @param fn     Mapper applied only when `result` is {@link Ok}.
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

/**
 * Transform the error of a {@link Result}, leaving successes untouched.
 * @param result The input result.
 * @param fn     Mapper applied only when `result` is {@link Err}.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error))
}

/**
 * Return the success value or a fallback when the result is a failure.
 * @param result   The input result.
 * @param fallback Value returned when `result` is {@link Err}.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/**
 * Return the success value or throw. Throws the contained error when it is an
 * `Error`; otherwise wraps it in an {@link AiError}.
 * @param result The input result.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value
  const error = result.error
  if (error instanceof Error) throw error
  throw new AiError('INTERNAL', 'Attempted to unwrap a failed Result', {
    detail: { error },
  })
}
