'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Types (mirror /api/admin/metrics) ────────────────────────────────────────
interface Metrics {
  range: string
  generatedAt: string
  signups: { total: number; delta30: number }
  traffic: {
    unavailable: boolean
    reason?: string
    sessions?: number
    users?: number
    pageviews?: number
    series?: { date: string; sessions: number; users: number }[]
  }
  users: {
    paidTotal: number
    referralTotal: number
    free: number
    freemiumRows: number
    estimatedRevenue: number
    paidByPlan: { key: string; name: string; price: number; count: number; revenue: number }[]
    referralByPlan: { key: string; name: string; count: number }[]
  }
  actions: {
    total: number
    delta30: number
    bySource: {
      choiceFilling: { total: number; delta30: number }
      rankPredictor: { total: number; delta30: number }
      referrals: { total: number; delta30: number }
      votes: { total: number; delta30: number; unavailable: boolean }
    }
  }
  signupsSeries: { date: string; count: number }[]
  actionsSeries: {
    date: string
    choiceFilling: number
    rankPredictor: number
    referrals: number
    votes: number
    total: number
  }[]
  planDistribution: { name: string; count: number; group: 'free' | 'paid' | 'referral' }[]
  warnings: string[]
}

const RANGES: { key: string; label: string }[] = [
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: 'all', label: 'All' },
]

const COLORS = {
  signups: '#6366f1',
  choiceFilling: '#2563eb',
  rankPredictor: '#16a34a',
  referrals: '#f59e0b',
  votes: '#db2777',
  free: '#94a3b8',
  paid: '#2563eb',
  referral: '#f59e0b',
  visits: '#0ea5e9',
  uniques: '#8b5cf6',
  pageviews: '#14b8a6',
}

const RANGE_LABELS: Record<string, string> = {
  '7': 'last 7 days',
  '30': 'last 30 days',
  '90': 'last 90 days',
  all: 'all time',
}

const nf = new Intl.NumberFormat('en-IN')
const inr = (n: number) => '₹' + nf.format(Math.round(n))
const num = (n: number) => nf.format(n)

function shortDate(d: string) {
  try {
    return format(parseISO(d), 'MMM d')
  } catch {
    return d
  }
}

// ── KPI tile ──────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  delta,
  accent,
  sub,
}: {
  label: string
  value: string
  delta?: number
  accent?: string
  sub?: string
}) {
  return (
    <Card className="overflow-hidden">
      {accent && <div className="h-1 w-full" style={{ backgroundColor: accent }} />}
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {typeof delta === 'number' && (
          <p
            className={cn(
              'mt-1 flex items-center gap-1 text-xs font-medium',
              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-muted-foreground'
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : delta < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {delta >= 0 ? '+' : ''}
            {num(delta)} in 30d
          </p>
        )}
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function chartTooltipStyle() {
  return {
    contentStyle: {
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  }
}

export default function InsightsDashboard() {
  const [range, setRange] = useState('30')
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (r: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/metrics?range=${r}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
  }, [range, load])

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">CYC Insights</h1>
            <p className="text-sm text-muted-foreground">
              {data
                ? `Updated ${format(parseISO(data.generatedAt), 'MMM d, yyyy · HH:mm')}`
                : 'Private analytics dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    'rounded px-3 py-1 text-sm font-medium transition-colors',
                    range === r.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => load(range)} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-rose-300">
            <CardContent className="p-4 text-sm text-rose-600">{error}</CardContent>
          </Card>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : data ? (
          <>
            {data.warnings.length > 0 && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {data.warnings.join(' ')}
              </div>
            )}

            {/* Row 1 — headline */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Total Signups" value={num(data.signups.total)} delta={data.signups.delta30} accent={COLORS.signups} />
              <Kpi label="Paid Users" value={num(data.users.paidTotal)} accent={COLORS.paid} sub={inr(data.users.estimatedRevenue) + ' est.'} />
              <Kpi label="Referral-earned" value={num(data.users.referralTotal)} accent={COLORS.referral} />
              <Kpi label="Free Users" value={num(data.users.free)} accent={COLORS.free} />
              <Kpi label="Total Actions" value={num(data.actions.total)} delta={data.actions.delta30} accent={COLORS.choiceFilling} />
            </div>

            {/* Traffic — Google Analytics (reflects the selected range) */}
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Traffic · {RANGE_LABELS[range]} · Google Analytics
              </h2>
              {data.traffic.unavailable ? (
                <Card>
                  <CardContent className="p-4 text-sm">
                    <p className="font-medium">Google Analytics not connected</p>
                    <p className="mt-1 text-muted-foreground">
                      {data.traffic.reason}. Set <code className="rounded bg-muted px-1">GA4_PROPERTY_ID</code> and grant the
                      service account Viewer access on the GA4 property to see site visits &amp; unique visitors.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <Kpi label="Site Visits" value={num(data.traffic.sessions || 0)} accent={COLORS.visits} sub="sessions" />
                    <Kpi label="Unique Visitors" value={num(data.traffic.users || 0)} accent={COLORS.uniques} sub="distinct users" />
                    <Kpi label="Pageviews" value={num(data.traffic.pageviews || 0)} accent={COLORS.pageviews} sub="page views" />
                  </div>
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Traffic over time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data.traffic.series || []} margin={{ left: -18, right: 8, top: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip {...chartTooltipStyle()} labelFormatter={(l) => shortDate(String(l))} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="sessions" name="Visits" stroke={COLORS.visits} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="users" name="Unique visitors" stroke={COLORS.uniques} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Paid & referral breakdown */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Paid users by plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.users.paidByPlan.map((p) => (
                    <div key={p.key} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span className="font-medium">
                        {p.name} <span className="text-muted-foreground">({inr(p.price)})</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">{num(p.count)} users</span>
                        <Badge variant="secondary" className="tabular-nums">{inr(p.revenue)}</Badge>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 text-sm font-semibold">
                    <span>Total</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">{num(data.users.paidTotal)} users</span>
                      <Badge className="tabular-nums">{inr(data.users.estimatedRevenue)}</Badge>
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Referral-earned by tier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.users.referralByPlan.map((p) => (
                    <div key={p.key} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span className="font-medium">{p.name}</span>
                      <span className="tabular-nums">{num(p.count)} users</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 text-sm font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{num(data.users.referralTotal)} users</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action source mini-tiles */}
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi label="Choice-filling" value={num(data.actions.bySource.choiceFilling.total)} delta={data.actions.bySource.choiceFilling.delta30} accent={COLORS.choiceFilling} />
              <Kpi label="Rank Predictor" value={num(data.actions.bySource.rankPredictor.total)} delta={data.actions.bySource.rankPredictor.delta30} accent={COLORS.rankPredictor} />
              <Kpi label="Referrals" value={num(data.actions.bySource.referrals.total)} delta={data.actions.bySource.referrals.delta30} accent={COLORS.referrals} />
              <Kpi
                label="Votes"
                value={data.actions.bySource.votes.unavailable ? 'N/A' : num(data.actions.bySource.votes.total)}
                delta={data.actions.bySource.votes.unavailable ? undefined : data.actions.bySource.votes.delta30}
                accent={COLORS.votes}
                sub={data.actions.bySource.votes.unavailable ? 'Sheet not connected' : undefined}
              />
            </div>

            {/* Charts */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Signups over time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.signupsSeries} margin={{ left: -18, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="gSignup" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.signups} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={COLORS.signups} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip {...chartTooltipStyle()} labelFormatter={(l) => shortDate(String(l))} />
                        <Area type="monotone" dataKey="count" name="Signups" stroke={COLORS.signups} strokeWidth={2} fill="url(#gSignup)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Actions over time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.actionsSeries} margin={{ left: -18, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip {...chartTooltipStyle()} labelFormatter={(l) => shortDate(String(l))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="choiceFilling" name="Choice-filling" stroke={COLORS.choiceFilling} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="rankPredictor" name="Rank Predictor" stroke={COLORS.rankPredictor} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="referrals" name="Referrals" stroke={COLORS.referrals} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="votes" name="Votes" stroke={COLORS.votes} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plan distribution */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Users by plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.planDistribution} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip {...chartTooltipStyle()} cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
                        {data.planDistribution.map((d, i) => (
                          <Cell key={i} fill={COLORS[d.group]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Revenue is estimated (current paid users × plan price); historical revenue/refunds aren&apos;t tracked yet.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
