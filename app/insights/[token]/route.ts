// GET /insights/<token>
// Validates the shared secret link, sets an httpOnly session cookie, and redirects
// to the clean /insights URL. Anything but a valid token returns 404 so the page's
// existence is never revealed.
import { NextRequest, NextResponse } from 'next/server'
import {
  DASHBOARD_COOKIE,
  getDashboardToken,
  isValidToken,
  sessionCookieValue,
} from '@/lib/dashboard-auth'

export const dynamic = 'force-dynamic'

function notFound() {
  return new NextResponse('Not found', { status: 404 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Feature not configured, or wrong link → behave as if nothing is here.
  if (!getDashboardToken() || !isValidToken(params.token)) {
    return notFound()
  }

  const value = sessionCookieValue()
  if (!value) return notFound()

  const res = NextResponse.redirect(new URL('/insights', request.url))
  res.cookies.set(DASHBOARD_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
