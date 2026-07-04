// GET /api/admin/metrics?range=7|30|90|all
// Aggregated analytics for the private /insights dashboard. Reads with the Supabase
// service-role key (bypasses RLS — the browser anon key cannot see other users' rows)
// and the vote Google Sheet. Protected by the same session cookie as the page.
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { DASHBOARD_COOKIE, isValidSession } from '@/lib/dashboard-auth'
import { PRICED_PLANS, PLAN_LIMITS } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Paid tiers (real money) and their referral-earned equivalents, from lib/plans.ts.
const PAID_META = PRICED_PLANS.map((p) => ({ key: p.planType, name: p.planName, price: p.price }))
const REFERRAL_META = PRICED_PLANS.map((p) => ({ key: p.referralPlanType, name: p.planName }))

const DAY = 24 * 60 * 60 * 1000
const MAX_SERIES_DAYS = 400

type Range = '7' | '30' | '90' | 'all'

function sinceForRange(range: Range): string | null {
  if (range === 'all') return null
  const days = parseInt(range, 10)
  return new Date(Date.now() - days * DAY).toISOString()
}

function dayKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

/** Exact row count (optionally filtered by created_at >= since and/or plan_type). */
async function countRows(
  table: string,
  opts: { since?: string | null; planType?: string } = {}
): Promise<number> {
  let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
  if (opts.since) q = q.gte('created_at', opts.since)
  if (opts.planType) q = q.eq('plan_type', opts.planType)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/** Fetch created_at values within range, paging past the 1000-row API cap. */
async function fetchDates(table: string, since: string | null): Promise<string[]> {
  const pageSize = 1000
  const maxPages = 25 // safety cap: up to 25k rows within the selected range
  const out: string[] = []
  for (let page = 0; page < maxPages; page++) {
    let q = supabaseAdmin
      .from(table)
      .select('created_at')
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (since) q = q.gte('created_at', since)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      const v = (row as { created_at?: string }).created_at
      if (v) out.push(v)
    }
    if (data.length < pageSize) break
  }
  return out
}

/** All vote timestamps (ISO) from the Google Sheet, or null if unavailable. */
async function fetchVoteDates(): Promise<string[] | null> {
  const creds = process.env.GOOGLE_CREDENTIALS
  const spreadsheetId = process.env.GOOGLE_VOTE_SHEET_ID
  if (!creds || !spreadsheetId) return null
  try {
    const googleCredentials = JSON.parse(creds)
    const auth = new JWT({
      email: googleCredentials.client_email,
      key: googleCredentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A:A' })
    const rows = resp.data.values || []
    const dates: string[] = []
    for (const r of rows) {
      const raw = r?.[0]
      if (!raw) continue
      const d = new Date(raw)
      if (isNaN(d.getTime())) continue // skips a header cell like "Timestamp"
      dates.push(d.toISOString())
    }
    return dates
  } catch {
    return null
  }
}

// ── Traffic from Google Analytics 4 (Data API) ────────────────────────────────
// Site visits = sessions, unique visitors = totalUsers. Range totals are queried
// without a date dimension (so GA dedupes users across the whole range); the daily
// series is a second report. Degrades to { unavailable } when GA isn't wired up.
function gaDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

interface TrafficResult {
  unavailable: boolean
  reason?: string
  sessions?: number
  users?: number
  pageviews?: number
  series?: { date: string; sessions: number; users: number; pageviews: number }[]
}

async function fetchTraffic(range: Range): Promise<TrafficResult> {
  const creds = process.env.GOOGLE_CREDENTIALS
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return { unavailable: true, reason: 'GA4_PROPERTY_ID not set' }
  if (!creds) return { unavailable: true, reason: 'GOOGLE_CREDENTIALS not set' }
  try {
    const googleCredentials = JSON.parse(creds)
    const auth = new JWT({
      email: googleCredentials.client_email,
      key: googleCredentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth })
    const property = `properties/${propertyId}`
    const startDate = range === 'all' ? '2020-01-01' : `${parseInt(range, 10)}daysAgo`
    const dateRanges = [{ startDate, endDate: 'today' }]

    const [totalsRes, seriesRes] = await Promise.all([
      analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
        },
      }),
      analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
          limit: '100000',
        },
      }),
    ])

    const tv = totalsRes.data.rows?.[0]?.metricValues || []
    const sessions = Number(tv[0]?.value || 0)
    const users = Number(tv[1]?.value || 0)
    const pageviews = Number(tv[2]?.value || 0)

    const series = (seriesRes.data.rows || []).map((r) => ({
      date: gaDate(r.dimensionValues?.[0]?.value || ''),
      sessions: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
      pageviews: Number(r.metricValues?.[2]?.value || 0),
    }))

    return { unavailable: false, sessions, users, pageviews, series }
  } catch (e: any) {
    return { unavailable: true, reason: e?.message || 'GA request failed' }
  }
}

function bucketByDay(isoDates: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const iso of isoDates) {
    const day = dayKey(iso)
    out[day] = (out[day] ?? 0) + 1
  }
  return out
}

function enumerateDays(startDay: string, endDay: string): string[] {
  const out: string[] = []
  let cur = new Date(`${startDay}T00:00:00Z`).getTime()
  const end = new Date(`${endDay}T00:00:00Z`).getTime()
  let guard = 0
  while (cur <= end && guard < MAX_SERIES_DAYS + 5) {
    out.push(new Date(cur).toISOString().slice(0, 10))
    cur += DAY
    guard++
  }
  return out
}

export async function GET(request: NextRequest) {
  // Same gate as the page: no valid session cookie → 404.
  const cookie = cookies().get(DASHBOARD_COOKIE)?.value
  if (!isValidSession(cookie)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const rangeParam = (request.nextUrl.searchParams.get('range') || '30') as Range
  const range: Range = ['7', '30', '90', 'all'].includes(rangeParam) ? rangeParam : '30'
  const since = sinceForRange(range)
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()
  const warnings: string[] = []

  try {
    // Kick off the Google Analytics report early; it runs while we hit Supabase.
    const trafficPromise = fetchTraffic(range)

    // ── Scalar counts (exact, unaffected by the row cap) ──────────────────────
    const [
      signupsTotal,
      signupsDelta30,
      cfTotal,
      cfDelta30,
      rpTotal,
      rpDelta30,
      refTotal,
      refDelta30,
      freemiumRows,
    ] = await Promise.all([
      countRows('profiles'),
      countRows('profiles', { since: since30 }),
      countRows('choice_filling_logs'),
      countRows('choice_filling_logs', { since: since30 }),
      countRows('rank_predictor_submissions'),
      countRows('rank_predictor_submissions', { since: since30 }),
      countRows('user_referrals'),
      countRows('user_referrals', { since: since30 }),
      countRows('choice_filling_usage', { planType: 'freemium' }),
    ])

    // Per-plan user counts.
    const paidCounts = await Promise.all(
      PAID_META.map((p) => countRows('choice_filling_usage', { planType: p.key }))
    )
    const referralCounts = await Promise.all(
      REFERRAL_META.map((p) => countRows('choice_filling_usage', { planType: p.key }))
    )

    const paidByPlan = PAID_META.map((p, i) => ({
      key: p.key,
      name: p.name,
      price: p.price,
      count: paidCounts[i],
      revenue: paidCounts[i] * p.price,
    }))
    const referralByPlan = REFERRAL_META.map((p, i) => ({
      key: p.key,
      name: p.name,
      count: referralCounts[i],
    }))

    const paidTotal = paidByPlan.reduce((s, p) => s + p.count, 0)
    const referralTotal = referralByPlan.reduce((s, p) => s + p.count, 0)
    const estimatedRevenue = paidByPlan.reduce((s, p) => s + p.revenue, 0)
    // Free = signups that aren't on a paid or referral-earned tier.
    const free = Math.max(0, signupsTotal - paidTotal - referralTotal)

    // ── Vote counts (Google Sheet) ────────────────────────────────────────────
    const voteDatesAll = await fetchVoteDates()
    const votesUnavailable = voteDatesAll === null
    if (votesUnavailable) {
      warnings.push('Votes unavailable (Google Sheet not configured or unreachable).')
    }
    const voteDates = voteDatesAll ?? []
    const votesTotal = voteDates.length
    const votesDelta30 = voteDates.filter((d) => d >= since30).length

    // ── Time series (within selected range) ───────────────────────────────────
    const [signupDates, cfDates, rpDates, refDates] = await Promise.all([
      fetchDates('profiles', since),
      fetchDates('choice_filling_logs', since),
      fetchDates('rank_predictor_submissions', since),
      fetchDates('user_referrals', since),
    ])
    const voteSeriesDates = since ? voteDates.filter((d) => d >= since) : voteDates

    const signupB = bucketByDay(signupDates)
    const cfB = bucketByDay(cfDates)
    const rpB = bucketByDay(rpDates)
    const refB = bucketByDay(refDates)
    const voteB = bucketByDay(voteSeriesDates)

    const endDay = new Date().toISOString().slice(0, 10)
    let startDay: string
    if (since) {
      startDay = since.slice(0, 10)
    } else {
      const allDays = [
        ...Object.keys(signupB),
        ...Object.keys(cfB),
        ...Object.keys(rpB),
        ...Object.keys(refB),
        ...Object.keys(voteB),
      ].sort()
      startDay = allDays[0] ?? endDay
    }
    // Clamp very long spans so the chart stays daily but bounded.
    const spanDays = (new Date(`${endDay}T00:00:00Z`).getTime() - new Date(`${startDay}T00:00:00Z`).getTime()) / DAY
    if (spanDays > MAX_SERIES_DAYS) {
      startDay = new Date(Date.now() - MAX_SERIES_DAYS * DAY).toISOString().slice(0, 10)
      warnings.push(`Trend truncated to the last ${MAX_SERIES_DAYS} days.`)
    }

    const days = enumerateDays(startDay, endDay)
    const signupsSeries = days.map((d) => ({ date: d, count: signupB[d] ?? 0 }))
    const actionsSeries = days.map((d) => {
      const choiceFilling = cfB[d] ?? 0
      const rankPredictor = rpB[d] ?? 0
      const referrals = refB[d] ?? 0
      const votes = voteB[d] ?? 0
      return {
        date: d,
        choiceFilling,
        rankPredictor,
        referrals,
        votes,
        total: choiceFilling + rankPredictor + referrals + votes,
      }
    })

    const actionsTotal = cfTotal + rpTotal + refTotal + votesTotal
    const actionsDelta30 = cfDelta30 + rpDelta30 + refDelta30 + votesDelta30

    const traffic = await trafficPromise
    if (traffic.unavailable) {
      warnings.push(`Site traffic unavailable (${traffic.reason}).`)
    }

    // Plan distribution for the bar chart (free + each paid + each referral tier).
    const planDistribution = [
      { name: 'Free', count: free, group: 'free' as const },
      ...paidByPlan.map((p) => ({ name: p.name, count: p.count, group: 'paid' as const })),
      ...referralByPlan.map((p) => ({ name: `${p.name} (ref)`, count: p.count, group: 'referral' as const })),
    ]

    return NextResponse.json({
      range,
      generatedAt: new Date().toISOString(),
      signups: { total: signupsTotal, delta30: signupsDelta30 },
      traffic,
      users: {
        paidTotal,
        referralTotal,
        free,
        freemiumRows,
        estimatedRevenue,
        paidByPlan,
        referralByPlan,
      },
      actions: {
        total: actionsTotal,
        delta30: actionsDelta30,
        bySource: {
          choiceFilling: { total: cfTotal, delta30: cfDelta30 },
          rankPredictor: { total: rpTotal, delta30: rpDelta30 },
          referrals: { total: refTotal, delta30: refDelta30 },
          votes: { total: votesTotal, delta30: votesDelta30, unavailable: votesUnavailable },
        },
      },
      signupsSeries,
      actionsSeries,
      planDistribution,
      warnings,
    })
  } catch (error: any) {
    console.error('Error building metrics:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to build metrics' },
      { status: 500 }
    )
  }
}
