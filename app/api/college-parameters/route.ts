// app/api/college-parameters/route.ts
// GET /api/college-parameters?nirf_id=IR-E-C-16614
// GET /api/college-parameters?counselling_code=1101
// GET /api/college-parameters?nirf_id=IR-E-C-16614&counselling_code=1101
//
// Returns all computed parameters for a college in one call.
// Response is cached for 1 hour (data is annual — recomputing every request is wasteful).

import { NextRequest, NextResponse } from 'next/server'
import { computeAllParameters } from '@/lib/parameters'

export const runtime = 'nodejs'          // needs Node — not Edge (Supabase client)
export const dynamic = 'force-dynamic'   // don't static-cache at build time

// Simple in-process cache — resets on serverless cold start, good enough for annual data
const CACHE: Map<string, { result: unknown; ts: number }> = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000   // 1 hour

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const nirfId          = searchParams.get('nirf_id')?.trim()     || null
  const counsellingCode = searchParams.get('counselling_code')?.trim() || null
  // Optional: request only specific sections
  const sections        = searchParams.get('sections')?.split(',') || null

  if (!nirfId && !counsellingCode) {
    return NextResponse.json(
      { error: 'Provide at least one of: nirf_id, counselling_code' },
      { status: 400 }
    )
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  const cacheKey = `${nirfId ?? ''}__${counsellingCode ?? ''}`
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      filterSections(cached.result, sections),
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'X-Cache': 'HIT',
        }
      }
    )
  }

  // ── Compute ────────────────────────────────────────────────────────────────
  try {
    const result = await computeAllParameters(nirfId, counsellingCode)

    // Store in cache
    CACHE.set(cacheKey, { result, ts: Date.now() })

    return NextResponse.json(
      filterSections(result, sections),
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'X-Cache': 'MISS',
        }
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[college-parameters] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Allow caller to request only specific sections to reduce payload
// e.g. ?sections=faculty,financial
function filterSections(result: unknown, sections: string[] | null): unknown {
  if (!sections || sections.length === 0) return result
  const full = result as Record<string, unknown>
  const always = ['nirf_id', 'counselling_code', 'computed_at', 'errors']
  const out: Record<string, unknown> = {}
  for (const key of [...always, ...sections]) {
    if (key in full) out[key] = full[key]
  }
  return out
}
