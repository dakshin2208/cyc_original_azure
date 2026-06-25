// lib/parameters.ts
// All 31 new parameters — computed live from Supabase on every API call.
// Student Outcome parameters (A section) are excluded — already implemented.
//
// Usage:
//   import { computeAllParameters } from '@/lib/parameters'
//   const params = await computeAllParameters(nirfId, counsellingCode)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendDirection = 'rising' | 'flat' | 'falling' | 'insufficient_data'

export interface FacultyParameters {
  // C1
  phd_pct: number | null
  // C2
  female_faculty_pct: number | null
  // C3
  avg_experience_years: number | null
  // C4
  experience_distribution: {
    senior_pct: number   // >20 years
    mid_pct: number      // 10–20 years
    junior_pct: number   // <10 years
  } | null
  // C5
  retention_rate_pct: number | null
  retention_flag: boolean          // true if < 85%
  // C6
  seniority_mix: {
    professor_pct: number
    associate_pct: number
    assistant_pct: number
  } | null
  // C7
  salary_per_faculty: number | null   // ₹/year
  // C8
  phd_pursuing_pct: number | null     // from nirf_institutions
  total_faculty: number | null
}

export interface AdmissionsDemandParameters {
  // B2 — fill rate trend
  fill_rate_5yr_avg: number | null
  fill_rate_trend: TrendDirection
  fill_rates_by_year: { year: number; fill_rate: number; available: number; allotted: number }[]
  intake_expanded: boolean   // seats grew >20% in any year
  // B4 — closing rank per category (all branches for this college)
  closing_ranks: {
    branch: string
    years: { year: number; oc: number | null; bc: number | null; bcm: number | null; mbc: number | null; sc: number | null; sca: number | null; st: number | null }[]
    avg_3yr: { oc: number | null; bc: number | null; bcm: number | null; mbc: number | null; sc: number | null; sca: number | null; st: number | null }
  }[]
  // B5 — cutoff volatility
  cutoff_volatility: {
    branch: string
    max_swing: number | null
    std_dev: number | null
    is_volatile: boolean   // max_swing > 5 OR std_dev > 3
  }[]
  // B6 — intake growth
  intake_growth_pct: number | null
  intake_current: number | null
  intake_oldest: number | null
}

export interface FinancialParameters {
  // D1
  spend_per_student: number | null          // ₹/year
  spend_per_student_components: {
    salaries: number | null
    maintenance: number | null
    total_students: number | null
  }
  // D2
  lab_spend_per_student: number | null      // ₹/year
  // D3
  lab_investment_trend_pct: number | null   // YoY %
  lab_investment_direction: 'up' | 'flat' | 'down' | null
  lab_current: number | null
  lab_previous: number | null
  // D4
  salary_growth_pct: number | null
  maintenance_growth_pct: number | null
  // D5
  seminar_spend_per_student: number | null
}

export interface ResearchParameters {
  // E1
  patents_per_100_faculty: number | null
  patents_published_latest: number | null
  // E2
  sponsored_research_per_faculty: number | null   // ₹
  sponsored_amount_latest: number | null
  // E3
  consultancy_revenue: number | null              // latest year ₹
  consultancy_trend_pct: number | null
  // E4
  phd_output_avg_per_year: number | null
  phd_fulltime_output: number | null
  phd_parttime_output: number | null
  // E5 — composite research score 0–100 (computed last, needs E1–E4)
  research_score: number | null
}

export interface StudentCompositionParameters {
  // F3
  reserved_category_pct: number | null     // SC/ST/OBC
  economically_backward_pct: number | null // EBC
  open_category_pct: number | null
  // F5
  pg_to_ug_ratio: number | null
  ug_total: number | null
  pg_total: number | null
}

export interface InfrastructureParameters {
  // G2
  naac_status: 'valid' | 'expiring' | 'lapsed' | 'not_accredited'
  naac_score: number | null
  naac_valid_upto: string | null
  naac_expiry_days: number | null
  // G3
  green_campus_score: number               // 0–6
  green_campus_tier: 'Green Campus' | 'Eco Aware' | 'Not Reported'
  green_details: {
    renewable_energy: boolean
    rainwater: boolean
    recycling: boolean
    food_waste: boolean
    plastic_reduction: boolean
    carbon_footprint: boolean
  }
  // G4
  accessibility_score: number              // 0–3
  accessibility_details: {
    lifts_ramps: boolean
    walking_aids: boolean
    toilets: boolean
  }
  // G5
  edp_programs_count: number | null
  edp_participants_per_program: number | null
}

export interface CrossSchemaParameters {
  // H1 — placement yield
  placement_yield_pct: number | null       // placed / total_allotted_5yr × 100
  // H2 — demand quality index
  demand_quality_index: number | null      // avg(fill_rate, placement_pct)
  // H3 — intake vs outcome efficiency
  intake_outcome_efficiency: number | null  // (placement_pct_now / placement_pct_3yr_ago) / (intake_now / intake_3yr_ago)
  // H4 — branch-level fill rates (TNEA-only, already in AdmissionsDemand)
  // H5 — salary to cost ratio: needs fee data, return null placeholder
  salary_cost_ratio: null   // Phase 2 — fee data not available
}

export interface CollegeParameters {
  nirf_id: string | null
  counselling_code: string | null
  faculty: FacultyParameters | null
  admissions: AdmissionsDemandParameters | null
  financial: FinancialParameters | null
  research: ResearchParameters | null
  student_composition: StudentCompositionParameters | null
  infrastructure: InfrastructureParameters | null
  cross_schema: CrossSchemaParameters | null
  computed_at: string
  errors: string[]
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function stdDev(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n))
  if (valid.length < 2) return null
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length
  return Math.sqrt(variance)
}

function trendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'insufficient_data'
  // Simple linear regression slope
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  values.forEach((y, i) => { num += (i - xMean) * (y - yMean); den += (i - xMean) ** 2 })
  const slope = den === 0 ? 0 : num / den
  if (slope > 0.5) return 'rising'
  if (slope < -0.5) return 'falling'
  return 'flat'
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (!current || !previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function nullSafe(n: number | null | undefined): number | null {
  if (n === null || n === undefined || isNaN(Number(n))) return null
  return Number(n)
}

// ─── B: Admissions Demand Parameters ─────────────────────────────────────────

async function computeAdmissionsParameters(
  counsellingCode: string
): Promise<AdmissionsDemandParameters> {
  const errors: string[] = []

  // B2, B4, B5 — from TNEA tables (filtered by counselling_code)
  const [allotData, rankData, cutoffData, intakeData] = await Promise.all([
    supabase
      .from('tnea_allotments')
      .select('year, allotted, available, fill_rate, branch')
      .eq('counselling_code', counsellingCode)
      .order('year'),
    supabase
      .from('tnea_ranks')
      .select('year, branch, oc, bc, bcm, mbc, sc, sca, st')
      .eq('counselling_code', counsellingCode)
      .order('year'),
    supabase
      .from('tnea_cutoffs')
      .select('year, branch, oc, bc, bcm, mbc, sc, sca, st')
      .eq('counselling_code', counsellingCode)
      .order('year'),
    supabase
      .from('nirf_sanctioned_intake')
      .select('academic_year, sanctioned_intake, program_level')
      .eq('nirf_id', counsellingCode)  // note: nirf_id here; will be null if no NIRF link
      .eq('program_level', 'UG')
      .order('academic_year'),
  ])

  // ── B2: Fill rate trend (college-level aggregate) ──
  const allotRows = allotData.data ?? []
  const byYear: Record<number, { allotted: number; available: number; fill_rates: number[] }> = {}
  for (const row of allotRows) {
    if (!byYear[row.year]) byYear[row.year] = { allotted: 0, available: 0, fill_rates: [] }
    byYear[row.year].allotted += row.allotted ?? 0
    byYear[row.year].available += row.available ?? 0
    if (row.fill_rate != null) byYear[row.year].fill_rates.push(Number(row.fill_rate))
  }
  const fillByYear = Object.entries(byYear)
    .map(([year, d]) => ({
      year: Number(year),
      fill_rate: d.available > 0 ? d.allotted / d.available : 0,
      available: d.available,
      allotted: d.allotted,
    }))
    .sort((a, b) => a.year - b.year)

  // Detect intake expansion: available seats grew >20% YoY
  let intakeExpanded = false
  for (let i = 1; i < fillByYear.length; i++) {
    const prev = fillByYear[i - 1].available
    const curr = fillByYear[i].available
    if (prev > 0 && (curr - prev) / prev > 0.2) { intakeExpanded = true; break }
  }

  const fillRateValues = fillByYear.map(r => r.fill_rate)
  const fill5yrAvg = avg(fillRateValues)
  const fillTrend = trendDirection(fillRateValues)

  // ── B4: Closing ranks per branch (avg of last 3 years per category) ──
  const rankRows = rankData.data ?? []
  const branchRankMap: Record<string, { year: number; oc: number | null; bc: number | null; bcm: number | null; mbc: number | null; sc: number | null; sca: number | null; st: number | null }[]> = {}
  for (const row of rankRows) {
    if (!branchRankMap[row.branch]) branchRankMap[row.branch] = []
    branchRankMap[row.branch].push({
      year: row.year,
      oc: nullSafe(row.oc), bc: nullSafe(row.bc), bcm: nullSafe(row.bcm),
      mbc: nullSafe(row.mbc), sc: nullSafe(row.sc), sca: nullSafe(row.sca), st: nullSafe(row.st)
    })
  }
  const cats = ['oc', 'bc', 'bcm', 'mbc', 'sc', 'sca', 'st'] as const
  const closingRanks = Object.entries(branchRankMap).map(([branch, years]) => {
    const last3 = years.sort((a, b) => b.year - a.year).slice(0, 3)
    const avg3yr = Object.fromEntries(
      cats.map(c => [c, avg(last3.map(y => y[c]))])
    ) as Record<typeof cats[number], number | null>
    return { branch, years, avg_3yr: avg3yr }
  })

  // ── B5: Cutoff volatility ──
  const cutoffRows = cutoffData.data ?? []
  const branchCutoffMap: Record<string, number[]> = {}
  for (const row of cutoffRows) {
    // Use OC as reference category for volatility; adjust if needed
    if (row.oc != null) {
      if (!branchCutoffMap[row.branch]) branchCutoffMap[row.branch] = []
      branchCutoffMap[row.branch].push(Number(row.oc))
    }
  }
  const cutoffVolatility = Object.entries(branchCutoffMap).map(([branch, values]) => {
    if (values.length < 2) return { branch, max_swing: null, std_dev: null, is_volatile: false }
    let maxSwing = 0
    for (let i = 1; i < values.length; i++) {
      maxSwing = Math.max(maxSwing, Math.abs(values[i] - values[i - 1]))
    }
    const sd = stdDev(values)
    return {
      branch,
      max_swing: Number(maxSwing.toFixed(2)),
      std_dev: sd ? Number(sd.toFixed(2)) : null,
      is_volatile: maxSwing > 5 || (sd !== null && sd > 3)
    }
  })

  // ── B6: Sanctioned intake growth ──
  const intakeRows = (intakeData.data ?? []).filter(r => r.program_level === 'UG')
  const intakeSorted = intakeRows.sort((a, b) => a.academic_year.localeCompare(b.academic_year))
  const intakeCurrent = intakeSorted.length ? nullSafe(intakeSorted[intakeSorted.length - 1].sanctioned_intake) : null
  const intakeOldest  = intakeSorted.length ? nullSafe(intakeSorted[0].sanctioned_intake) : null
  const intakeGrowth  = pctChange(intakeCurrent, intakeOldest)

  return {
    fill_rate_5yr_avg: fill5yrAvg ? Number((fill5yrAvg * 100).toFixed(1)) : null,
    fill_rate_trend: fillTrend,
    fill_rates_by_year: fillByYear,
    intake_expanded: intakeExpanded,
    closing_ranks: closingRanks,
    cutoff_volatility: cutoffVolatility,
    intake_growth_pct: intakeGrowth ? Number(intakeGrowth.toFixed(1)) : null,
    intake_current: intakeCurrent,
    intake_oldest: intakeOldest,
  }
}

// ─── C: Faculty Quality Parameters ───────────────────────────────────────────

async function computeFacultyParameters(nirfId: string): Promise<FacultyParameters> {
  const [facultyData, financialData, institutionData] = await Promise.all([
    supabase
      .from('nirf_faculty')
      .select('designation, gender, qualification, experience_months, currently_working')
      .eq('nirf_id', nirfId),
    supabase
      .from('nirf_financial_operational')
      .select('academic_year, salaries')
      .eq('nirf_id', nirfId)
      .order('academic_year', { ascending: false })
      .limit(1),
    supabase
      .from('nirf_institutions')
      .select('phd_fulltime_pursuing, phd_parttime_pursuing')
      .eq('nirf_id', nirfId)
      .single(),
  ])

  const faculty = facultyData.data ?? []
  const total = faculty.length
  if (total === 0) {
    return {
      phd_pct: null, female_faculty_pct: null, avg_experience_years: null,
      experience_distribution: null, retention_rate_pct: null, retention_flag: false,
      seniority_mix: null, salary_per_faculty: null, phd_pursuing_pct: null, total_faculty: 0
    }
  }

  // C1: PhD %
  const phdCount = faculty.filter(f =>
    f.qualification && f.qualification.toLowerCase().includes('ph.d')
  ).length
  const phd_pct = Number(((phdCount / total) * 100).toFixed(1))

  // C2: Female faculty %
  const femaleCount = faculty.filter(f => f.gender === 'Female').length
  const female_faculty_pct = Number(((femaleCount / total) * 100).toFixed(1))

  // C3: Avg experience — only currently working
  const activeFaculty = faculty.filter(f => f.currently_working === 'Yes')
  const expMonths = activeFaculty
    .map(f => nullSafe(f.experience_months))
    .filter((n): n is number => n !== null)
  const avgExpMonths = avg(expMonths)
  const avg_experience_years = avgExpMonths ? Number((avgExpMonths / 12).toFixed(1)) : null

  // C4: Experience distribution
  const totalActive = activeFaculty.length
  let senior = 0, mid = 0, junior = 0
  for (const f of activeFaculty) {
    const yrs = (nullSafe(f.experience_months) ?? 0) / 12
    if (yrs > 20) senior++
    else if (yrs >= 10) mid++
    else junior++
  }
  const experience_distribution = totalActive > 0 ? {
    senior_pct: Number(((senior / totalActive) * 100).toFixed(1)),
    mid_pct:    Number(((mid    / totalActive) * 100).toFixed(1)),
    junior_pct: Number(((junior / totalActive) * 100).toFixed(1)),
  } : null

  // C5: Retention rate
  const working = faculty.filter(f => f.currently_working === 'Yes').length
  const retention_rate_pct = Number(((working / total) * 100).toFixed(1))
  const retention_flag = retention_rate_pct < 85

  // C6: Seniority mix
  const PROFESSOR_LABELS = ['Professor']
  const ASSOCIATE_LABELS = ['Associate Professor']
  const ASSISTANT_LABELS = ['Assistant Professor', 'Lecturer']
  const profCount   = faculty.filter(f => PROFESSOR_LABELS.includes(f.designation)).length
  const assocCount  = faculty.filter(f => ASSOCIATE_LABELS.includes(f.designation)).length
  const asstCount   = faculty.filter(f => ASSISTANT_LABELS.includes(f.designation)).length
  const seniority_mix = {
    professor_pct:  Number(((profCount  / total) * 100).toFixed(1)),
    associate_pct:  Number(((assocCount / total) * 100).toFixed(1)),
    assistant_pct:  Number(((asstCount  / total) * 100).toFixed(1)),
  }

  // C7: Salary per faculty
  const latestFinancial = (financialData.data ?? [])[0]
  const totalSalary = latestFinancial ? nullSafe(latestFinancial.salaries) : null
  const salary_per_faculty = totalSalary && total > 0
    ? Math.round(totalSalary / total)
    : null

  // C8: PhD-pursuing %
  const inst = institutionData.data
  const phdPursuing = (nullSafe(inst?.phd_fulltime_pursuing) ?? 0) +
                      (nullSafe(inst?.phd_parttime_pursuing) ?? 0)
  const phd_pursuing_pct = total > 0
    ? Number(((phdPursuing / total) * 100).toFixed(1))
    : null

  return {
    phd_pct,
    female_faculty_pct,
    avg_experience_years,
    experience_distribution,
    retention_rate_pct,
    retention_flag,
    seniority_mix,
    salary_per_faculty,
    phd_pursuing_pct,
    total_faculty: total,
  }
}

// ─── D: Financial Investment Parameters ──────────────────────────────────────

async function computeFinancialParameters(nirfId: string): Promise<FinancialParameters> {
  const [capitalData, operationalData, strengthData] = await Promise.all([
    supabase
      .from('nirf_financial_capital')
      .select('academic_year, lab_equipment_software')
      .eq('nirf_id', nirfId)
      .in('academic_year', ['2023-24', '2022-23'])
      .order('academic_year', { ascending: false }),
    supabase
      .from('nirf_financial_operational')
      .select('academic_year, salaries, maintenance_infrastructure, seminars_workshops')
      .eq('nirf_id', nirfId)
      .in('academic_year', ['2023-24', '2022-23'])
      .order('academic_year', { ascending: false }),
    supabase
      .from('nirf_student_strength')
      .select('total_students, program_level')
      .eq('nirf_id', nirfId),
  ])

  const capitalRows      = capitalData.data ?? []
  const operationalRows  = operationalData.data ?? []
  const strengthRows     = strengthData.data ?? []

  // Get UG total students (latest)
  const ugRow = strengthRows.find(r => r.program_level?.includes('UG [4'))
    ?? strengthRows.find(r => r.program_level?.startsWith('UG'))
  const ugTotal = ugRow ? nullSafe(ugRow.total_students) : null

  // Latest and previous year financial data
  const latest = operationalRows.find(r => r.academic_year === '2023-24')
  const prev    = operationalRows.find(r => r.academic_year === '2022-23')
  const capLatest = capitalRows.find(r => r.academic_year === '2023-24')
  const capPrev   = capitalRows.find(r => r.academic_year === '2022-23')

  const salariesLatest      = nullSafe(latest?.salaries)
  const maintenanceLatest   = nullSafe(latest?.maintenance_infrastructure)
  const salariesPrev        = nullSafe(prev?.salaries)
  const maintenancePrev     = nullSafe(prev?.maintenance_infrastructure)
  const labCurrent          = nullSafe(capLatest?.lab_equipment_software)
  const labPrevious         = nullSafe(capPrev?.lab_equipment_software)
  const seminarsLatest      = nullSafe(latest?.seminars_workshops)

  // D1: Spend per student
  const totalOpex = (salariesLatest ?? 0) + (maintenanceLatest ?? 0)
  const spend_per_student = ugTotal && ugTotal > 0 && totalOpex > 0
    ? Math.round(totalOpex / ugTotal)
    : null

  // D2: Lab spend per student
  const lab_spend_per_student = ugTotal && ugTotal > 0 && labCurrent
    ? Math.round(labCurrent / ugTotal)
    : null

  // D3: Lab investment trend
  const labTrendPct = pctChange(labCurrent, labPrevious)
  let lab_investment_direction: 'up' | 'flat' | 'down' | null = null
  if (labTrendPct !== null) {
    lab_investment_direction = labTrendPct > 10 ? 'up' : labTrendPct < -10 ? 'down' : 'flat'
  }

  // D4: Salary and maintenance growth
  const salary_growth_pct      = pctChange(salariesLatest, salariesPrev)
  const maintenance_growth_pct = pctChange(maintenanceLatest, maintenancePrev)

  // D5: Seminar spend per student
  const seminar_spend_per_student = ugTotal && ugTotal > 0 && seminarsLatest
    ? Math.round(seminarsLatest / ugTotal)
    : null

  return {
    spend_per_student,
    spend_per_student_components: {
      salaries: salariesLatest,
      maintenance: maintenanceLatest,
      total_students: ugTotal,
    },
    lab_spend_per_student,
    lab_investment_trend_pct: labTrendPct ? Number(labTrendPct.toFixed(1)) : null,
    lab_investment_direction,
    lab_current: labCurrent,
    lab_previous: labPrevious,
    salary_growth_pct: salary_growth_pct ? Number(salary_growth_pct.toFixed(1)) : null,
    maintenance_growth_pct: maintenance_growth_pct ? Number(maintenance_growth_pct.toFixed(1)) : null,
    seminar_spend_per_student,
  }
}

// ─── E: Research & Innovation Parameters ─────────────────────────────────────

async function computeResearchParameters(
  nirfId: string,
  totalFaculty: number | null
): Promise<ResearchParameters> {
  const [iprData, sponsoredData, consultancyData, phdData] = await Promise.all([
    supabase
      .from('nirf_ipr')
      .select('calendar_year, patents_published')
      .eq('nirf_id', nirfId)
      .order('calendar_year', { ascending: false })
      .limit(2),
    supabase
      .from('nirf_sponsored_research')
      .select('financial_year, total_amount_received')
      .eq('nirf_id', nirfId)
      .order('financial_year', { ascending: false })
      .limit(2),
    supabase
      .from('nirf_consultancy')
      .select('financial_year, total_amount_received')
      .eq('nirf_id', nirfId)
      .order('financial_year', { ascending: false })
      .limit(2),
    supabase
      .from('nirf_phd_graduated')
      .select('academic_year, fulltime_graduated, parttime_graduated')
      .eq('nirf_id', nirfId)
      .in('academic_year', ['2023-24', '2022-23']),
  ])

  const iprRows        = iprData.data ?? []
  const sponsoredRows  = sponsoredData.data ?? []
  const consultRows    = consultancyData.data ?? []
  const phdRows        = phdData.data ?? []

  // E1: Patents per 100 faculty
  const latestIPR = iprRows[0]
  const patents_published_latest = nullSafe(latestIPR?.patents_published)
  const patents_per_100_faculty = patents_published_latest !== null && totalFaculty
    ? Number(((patents_published_latest / totalFaculty) * 100).toFixed(2))
    : null

  // E2: Sponsored research per faculty
  const latestSponsored = sponsoredRows[0]
  const sponsored_amount_latest = nullSafe(latestSponsored?.total_amount_received)
  const sponsored_research_per_faculty = sponsored_amount_latest !== null && totalFaculty
    ? Math.round(sponsored_amount_latest / totalFaculty)
    : null

  // E3: Consultancy revenue + trend
  const latestConsult = consultRows[0]
  const prevConsult   = consultRows[1]
  const consultancy_revenue = nullSafe(latestConsult?.total_amount_received)
  const consultancy_trend_pct = pctChange(
    nullSafe(latestConsult?.total_amount_received),
    nullSafe(prevConsult?.total_amount_received)
  )

  // E4: PhD output avg per year
  const phdOutputs = phdRows.map(r =>
    (nullSafe(r.fulltime_graduated) ?? 0) + (nullSafe(r.parttime_graduated) ?? 0)
  )
  const phd_output_avg_per_year = phdOutputs.length ? avg(phdOutputs) : null
  const latestPhd = phdRows.find(r => r.academic_year === '2023-24')
  const phd_fulltime_output  = nullSafe(latestPhd?.fulltime_graduated)
  const phd_parttime_output  = nullSafe(latestPhd?.parttime_graduated)

  // E5: Research Score (0–100)
  // Each component scored 0–25, then summed
  const scorePatents = patents_per_100_faculty !== null
    ? Math.min(25, (patents_per_100_faculty / 50) * 25)  // 50 patents/100 faculty = full score
    : null
  const scoreSponsored = sponsored_research_per_faculty !== null
    ? Math.min(25, (sponsored_research_per_faculty / 100000) * 25)  // ₹1L/faculty = full
    : null
  const scoreConsultancy = consultancy_revenue !== null
    ? Math.min(25, (consultancy_revenue / 50000000) * 25)  // ₹5Cr = full
    : null
  const scorePhd = phd_output_avg_per_year !== null
    ? Math.min(25, (phd_output_avg_per_year / 50) * 25)  // 50 PhDs/yr = full
    : null

  const scoreComponents = [scorePatents, scoreSponsored, scoreConsultancy, scorePhd]
  const validComponents = scoreComponents.filter((s): s is number => s !== null)
  const research_score = validComponents.length === 4
    ? Number(validComponents.reduce((a, b) => a + b, 0).toFixed(1))
    : null

  return {
    patents_per_100_faculty,
    patents_published_latest,
    sponsored_research_per_faculty,
    sponsored_amount_latest,
    consultancy_revenue,
    consultancy_trend_pct: consultancy_trend_pct ? Number(consultancy_trend_pct.toFixed(1)) : null,
    phd_output_avg_per_year: phd_output_avg_per_year ? Number(phd_output_avg_per_year.toFixed(1)) : null,
    phd_fulltime_output,
    phd_parttime_output,
    research_score,
  }
}

// ─── F: Student Composition Parameters ───────────────────────────────────────

async function computeStudentCompositionParameters(nirfId: string): Promise<StudentCompositionParameters> {
  const { data } = await supabase
    .from('nirf_student_strength')
    .select('program_level, total_students, economically_backward, socially_challenged, full_fee_reimbursement, female_students')
    .eq('nirf_id', nirfId)

  const rows = data ?? []
  const ugRow = rows.find(r => r.program_level?.includes('UG [4'))
    ?? rows.find(r => r.program_level?.startsWith('UG'))
  const pgRow = rows.find(r => r.program_level?.includes('PG [2'))
    ?? rows.find(r => r.program_level?.startsWith('PG'))

  const ugTotal = ugRow ? nullSafe(ugRow.total_students) : null
  const pgTotal = pgRow ? nullSafe(pgRow.total_students) : null

  // F3: Category composition
  const socialChallenged    = ugRow ? nullSafe(ugRow.socially_challenged)    : null
  const econBackward        = ugRow ? nullSafe(ugRow.economically_backward)  : null
  const noReserve           = ugRow ? nullSafe(ugRow.full_fee_reimbursement) : null

  const reserved_category_pct      = ugTotal && socialChallenged !== null
    ? Number(((socialChallenged / ugTotal) * 100).toFixed(1)) : null
  const economically_backward_pct  = ugTotal && econBackward !== null
    ? Number(((econBackward / ugTotal) * 100).toFixed(1)) : null
  const open_category_pct          = ugTotal && noReserve !== null
    ? Number(((noReserve / ugTotal) * 100).toFixed(1)) : null

  // F5: PG-to-UG ratio
  const pg_to_ug_ratio = ugTotal && pgTotal && ugTotal > 0
    ? Number((pgTotal / ugTotal).toFixed(3))
    : null

  return {
    reserved_category_pct,
    economically_backward_pct,
    open_category_pct,
    pg_to_ug_ratio,
    ug_total: ugTotal,
    pg_total: pgTotal,
  }
}

// ─── G: Infrastructure & Accreditation Parameters ────────────────────────────

async function computeInfrastructureParameters(nirfId: string): Promise<InfrastructureParameters> {
  const [accredData, sdgQualData, institutionData, edpData] = await Promise.all([
    supabase
      .from('nirf_accreditation')
      .select('body, valid_from, valid_to, grade_or_score')
      .eq('nirf_id', nirfId)
      .eq('body', 'NAAC')
      .order('valid_from', { ascending: false })
      .limit(1),
    supabase
      .from('nirf_sdg_qualitative')
      .select('*')
      .eq('nirf_id', nirfId)
      .maybeSingle(),
    supabase
      .from('nirf_institutions')
      .select('pcs_lifts_ramps, pcs_walking_aids, pcs_toilets')
      .eq('nirf_id', nirfId)
      .single(),
    supabase
      .from('nirf_executive_dev_programs')
      .select('total_programs, total_participants')
      .eq('nirf_id', nirfId)
      .eq('financial_year', '2023-24')
      .maybeSingle(),
  ])

  // G2: NAAC status
  const naacRow = (accredData.data ?? [])[0]
  let naac_status: InfrastructureParameters['naac_status'] = 'not_accredited'
  let naac_score: number | null = null
  let naac_valid_upto: string | null = null
  let naac_expiry_days: number | null = null

  if (naacRow) {
    naac_score = naacRow.grade_or_score ? parseFloat(naacRow.grade_or_score) : null
    naac_valid_upto = naacRow.valid_to ?? null
    if (naac_valid_upto) {
      const expiryDate = new Date(naac_valid_upto)
      const today = new Date()
      const diffMs = expiryDate.getTime() - today.getTime()
      naac_expiry_days = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (naac_expiry_days < 0)         naac_status = 'lapsed'
      else if (naac_expiry_days < 365)  naac_status = 'expiring'
      else                               naac_status = 'valid'
    }
  }

  // G3: Green campus score from sdg_qualitative
  // A non-empty value in each field = college has that practice
  const sdq = sdgQualData.data
  const hasRenewable  = !!(sdq?.renewable_energy_sources?.trim())
  const hasRainwater  = !!(sdq?.rainwater_harvesting_types?.trim())
  const hasRecycling  = !!(sdq?.recycling_infrastructure?.trim())
  const hasFoodWaste  = !!(sdq?.food_waste_approach?.trim())
  const hasPlastic    = !!(sdq?.single_use_plastic_measures?.trim())
  const hasCarbon     = !!(sdq?.carbon_footprint_actions?.trim())

  const green_campus_score = [hasRenewable, hasRainwater, hasRecycling, hasFoodWaste, hasPlastic, hasCarbon]
    .filter(Boolean).length

  const green_campus_tier: InfrastructureParameters['green_campus_tier'] =
    green_campus_score === 6 ? 'Green Campus'
    : green_campus_score >= 3 ? 'Eco Aware'
    : 'Not Reported'

  // G4: Accessibility score from nirf_institutions PCS fields
  const inst = institutionData.data
  const hasLifts    = !!(inst?.pcs_lifts_ramps?.toLowerCase().includes('yes'))
  const hasWheels   = !!(inst?.pcs_walking_aids?.toLowerCase().includes('yes'))
  const hasToilets  = !!(inst?.pcs_toilets?.toLowerCase().includes('yes'))
  const accessibility_score = [hasLifts, hasWheels, hasToilets].filter(Boolean).length

  // G5: EDP programs
  const edp = edpData.data
  const edp_programs_count = edp ? nullSafe(edp.total_programs) : null
  const edp_participants_per_program =
    edp_programs_count && edp_programs_count > 0 && edp?.total_participants
      ? Number((edp.total_participants / edp_programs_count).toFixed(1))
      : null

  return {
    naac_status,
    naac_score,
    naac_valid_upto,
    naac_expiry_days,
    green_campus_score,
    green_campus_tier,
    green_details: {
      renewable_energy: hasRenewable,
      rainwater: hasRainwater,
      recycling: hasRecycling,
      food_waste: hasFoodWaste,
      plastic_reduction: hasPlastic,
      carbon_footprint: hasCarbon,
    },
    accessibility_score,
    accessibility_details: {
      lifts_ramps: hasLifts,
      walking_aids: hasWheels,
      toilets: hasToilets,
    },
    edp_programs_count,
    edp_participants_per_program,
  }
}

// ─── H: Cross-Schema Parameters ──────────────────────────────────────────────

async function computeCrossSchemaParameters(
  nirfId: string | null,
  counsellingCode: string | null,
  admissions: AdmissionsDemandParameters | null
): Promise<CrossSchemaParameters> {
  if (!nirfId || !counsellingCode) {
    return { placement_yield_pct: null, demand_quality_index: null, intake_outcome_efficiency: null, salary_cost_ratio: null }
  }

  // H1: Placement yield = placed / total_allotted_across_5yr
  const [placementData, allotmentData] = await Promise.all([
    supabase
      .from('nirf_placement_higher_studies')
      .select('graduating_year, students_placed, first_year_admitted, lateral_entry_count')
      .eq('nirf_id', nirfId)
      .eq('program_level', 'UG')
      .order('graduating_year', { ascending: false })
      .limit(1),
    supabase
      .from('tnea_allotments')
      .select('year, allotted')
      .eq('counselling_code', counsellingCode)
      .order('year', { ascending: false })
      .limit(5),
  ])

  const latestPlacement = (placementData.data ?? [])[0]
  const totalAllotted5yr = (allotmentData.data ?? [])
    .reduce((sum, r) => sum + (nullSafe(r.allotted) ?? 0), 0)

  // Placed from latest cohort vs all allotted across 5yr (rough yield signal)
  const placed = nullSafe(latestPlacement?.students_placed)
  const placement_yield_pct = placed !== null && totalAllotted5yr > 0
    ? Number(((placed / (totalAllotted5yr / 5)) * 100).toFixed(1))  // normalise to avg year
    : null

  // H2: Demand-Quality Index = avg(fill_rate_5yr, placement_pct_latest)
  const fillRate5yr = admissions?.fill_rate_5yr_avg ?? null
  const cohort = latestPlacement
    ? (nullSafe(latestPlacement.first_year_admitted) ?? 0) +
      (nullSafe(latestPlacement.lateral_entry_count) ?? 0)
    : null
  const placementPct = cohort && cohort > 0 && placed !== null
    ? (placed / cohort) * 100
    : null

  const demand_quality_index = fillRate5yr !== null && placementPct !== null
    ? Number(((fillRate5yr + placementPct) / 2).toFixed(1))
    : null

  // H3: Intake vs outcome efficiency
  // Need 2 placement rows (now and 3yr ago)
  const { data: placementHistory } = await supabase
    .from('nirf_placement_higher_studies')
    .select('graduating_year, students_placed, first_year_admitted, lateral_entry_count')
    .eq('nirf_id', nirfId)
    .eq('program_level', 'UG')
    .order('graduating_year', { ascending: false })
    .limit(3)

  let intake_outcome_efficiency: number | null = null
  if (placementHistory && placementHistory.length >= 2) {
    const newest = placementHistory[0]
    const oldest = placementHistory[placementHistory.length - 1]
    const cohortNew = (nullSafe(newest.first_year_admitted) ?? 0) + (nullSafe(newest.lateral_entry_count) ?? 0)
    const cohortOld = (nullSafe(oldest.first_year_admitted) ?? 0) + (nullSafe(oldest.lateral_entry_count) ?? 0)
    const pctNew = cohortNew > 0 ? (nullSafe(newest.students_placed) ?? 0) / cohortNew : null
    const pctOld = cohortOld > 0 ? (nullSafe(oldest.students_placed) ?? 0) / cohortOld : null
    if (pctNew && pctOld && pctOld > 0 && cohortOld > 0 && cohortNew > 0) {
      const outcomeRatio = pctNew / pctOld
      const intakeRatio  = cohortNew / cohortOld
      intake_outcome_efficiency = Number((outcomeRatio / intakeRatio).toFixed(3))
    }
  }

  return {
    placement_yield_pct,
    demand_quality_index,
    intake_outcome_efficiency,
    salary_cost_ratio: null,  // Phase 2 — fee data not yet available
  }
}

// ─── Master function ──────────────────────────────────────────────────────────

export async function computeAllParameters(
  nirfId: string | null,
  counsellingCode: string | null
): Promise<CollegeParameters> {
  const errors: string[] = []
  if (!nirfId && !counsellingCode) {
    errors.push('At least one of nirfId or counsellingCode is required')
    return {
      nirf_id: null, counselling_code: null,
      faculty: null, admissions: null, financial: null,
      research: null, student_composition: null, infrastructure: null,
      cross_schema: null, computed_at: new Date().toISOString(), errors
    }
  }

  // Run independent sections in parallel where possible
  const [faculty, admissions, financial, studentComp, infrastructure] = await Promise.all([
    nirfId ? computeFacultyParameters(nirfId).catch(e => { errors.push(`faculty: ${e.message}`); return null }) : null,
    counsellingCode ? computeAdmissionsParameters(counsellingCode).catch(e => { errors.push(`admissions: ${e.message}`); return null }) : null,
    nirfId ? computeFinancialParameters(nirfId).catch(e => { errors.push(`financial: ${e.message}`); return null }) : null,
    nirfId ? computeStudentCompositionParameters(nirfId).catch(e => { errors.push(`student_composition: ${e.message}`); return null }) : null,
    nirfId ? computeInfrastructureParameters(nirfId).catch(e => { errors.push(`infrastructure: ${e.message}`); return null }) : null,
  ])

  // Research needs totalFaculty from faculty result
  const research = nirfId
    ? await computeResearchParameters(nirfId, faculty?.total_faculty ?? null)
        .catch(e => { errors.push(`research: ${e.message}`); return null })
    : null

  // Cross-schema needs admissions result
  const crossSchema = await computeCrossSchemaParameters(nirfId, counsellingCode, admissions)
    .catch(e => { errors.push(`cross_schema: ${e.message}`); return null })

  return {
    nirf_id: nirfId,
    counselling_code: counsellingCode,
    faculty,
    admissions,
    financial,
    research,
    student_composition: studentComp,
    infrastructure,
    cross_schema: crossSchema,
    computed_at: new Date().toISOString(),
    errors,
  }
}
