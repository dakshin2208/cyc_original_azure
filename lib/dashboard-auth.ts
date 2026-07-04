// lib/dashboard-auth.ts
// Access control for the private analytics dashboard (/insights).
//
// Model: a single shared secret link. Opening /insights/<DASHBOARD_TOKEN> validates
// the token server-side and drops an httpOnly session cookie so the whole team can
// use the clean /insights URL afterwards (the secret never stays in the address bar
// or browser history). Rotating DASHBOARD_TOKEN instantly revokes every session.
import crypto from 'crypto'

/** Name of the httpOnly session cookie set after a valid link is opened. */
export const DASHBOARD_COOKIE = 'insights_session'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/** The configured dashboard token, or null if the feature isn't set up. */
export function getDashboardToken(): string | null {
  const t = process.env.DASHBOARD_TOKEN
  return t && t.length > 0 ? t : null
}

/** Constant-time string comparison (avoids leaking length/position via timing). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Value stored in the session cookie — a hash of the token, not the raw secret,
 * so the token itself never lives in the cookie jar.
 */
export function sessionCookieValue(): string | null {
  const token = getDashboardToken()
  return token ? sha256(token) : null
}

/** Validate a raw token from the URL against the configured token. */
export function isValidToken(candidate: string | null | undefined): boolean {
  const token = getDashboardToken()
  if (!token || !candidate) return false
  return safeEqual(candidate, token)
}

/** Validate a session cookie value against the expected hash. */
export function isValidSession(cookieValue: string | null | undefined): boolean {
  const expected = sessionCookieValue()
  if (!expected || !cookieValue) return false
  return safeEqual(cookieValue, expected)
}
