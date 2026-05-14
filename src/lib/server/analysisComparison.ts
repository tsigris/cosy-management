import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countInclusiveDays,
  enumerateDateKeys,
  formatRangeLabel,
  formatShortDateKey,
  getWeekdayLabel,
  getYearOverYearRanges,
  type FinancialDateRange,
} from '@/lib/financialPeriods'
import type {
  ComparisonTrend,
  FinancialComparisonDayRow,
  FinancialComparisonResponse,
  FinancialComparisonWeekdayRow,
  FinancialMetricComparison,
} from '@/types/analysisComparison'

const TRANSFER_CATEGORIES = new Set(['μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου'])
const CASH_METHOD_KEYS = ['μετρητά', 'μετρητά (z)', 'cash']
const CARD_METHOD_KEYS = ['κάρτα', 'τράπεζα', 'card', 'bank', 'pos']
const WEEKDAY_ORDER = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ']

type AnalysisSummaryRpc = {
  income?: number | null
  expenses?: number | null
  net_profit?: number | null
  credit_outstanding?: number | null
}

type PayrollPeriodRpc = {
  payroll_pct?: number | null
}

type CollapsedZRpc = {
  date?: string | null
  total_z?: number | null
}

type RevenueTxRow = {
  date?: string | null
  amount?: number | null
  type?: string | null
  method?: string | null
  category?: string | null
  is_credit?: boolean | null
}

type PeriodAggregate = {
  range: FinancialDateRange
  days: number
  totalRevenue: number
  cashRevenue: number
  cardRevenue: number
  transactionCount: number
  averageTicket: number
  averageDailyRevenue: number
  expenses: number
  profit: number
  payrollPct: number
  zTotals: number
  creditTotals: number
  revenueByDate: Record<string, number>
  zByDate: Record<string, number>
}

function toNumber(value: unknown): number {
  const next = Number(value || 0)
  return Number.isFinite(next) ? next : 0
}

function normalizeMethod(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function isTransferCategory(category: string | null | undefined): boolean {
  return TRANSFER_CATEGORIES.has(String(category || '').trim().toLowerCase())
}

function isCashMethod(method: string | null | undefined): boolean {
  const normalized = normalizeMethod(method)
  return CASH_METHOD_KEYS.some((candidate) => normalized.includes(candidate))
}

function isCardMethod(method: string | null | undefined): boolean {
  const normalized = normalizeMethod(method)
  return CARD_METHOD_KEYS.some((candidate) => normalized.includes(candidate))
}

function buildComparisonMetric(current: number, previous: number): FinancialMetricComparison {
  const delta = current - previous
  const deltaPct = previous === 0 ? (current === 0 ? 0 : null) : (delta / previous) * 100

  let trend: ComparisonTrend = 'flat'
  if (delta > 0) trend = 'up'
  if (delta < 0) trend = 'down'

  return {
    current,
    previous,
    delta,
    deltaPct,
    trend,
  }
}

async function loadAnalysisSummary(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<AnalysisSummaryRpc> {
  const { data, error } = await supabase.rpc('get_analysis_summary', {
    p_store_id: storeId,
    p_start_date: range.from,
    p_end_date: range.to,
  })

  if (error) throw error

  const raw = Array.isArray(data) ? data[0] : data
  return (raw?.get_analysis_summary ?? raw ?? {}) as AnalysisSummaryRpc
}

async function loadPayrollSummary(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<PayrollPeriodRpc> {
  const { data, error } = await supabase.rpc('get_staff_payroll_pressure_period_summary', {
    p_store_id: storeId,
    p_start_date: range.from,
    p_end_date: range.to,
  })

  if (error) throw error

  const raw = Array.isArray(data) ? data[0] : data
  return (raw ?? {}) as PayrollPeriodRpc
}

async function loadCollapsedZ(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<CollapsedZRpc[]> {
  const { data, error } = await supabase.rpc('get_analysis_collapsed_period', {
    p_store_id: storeId,
    p_start_date: range.from,
    p_end_date: range.to,
  })

  if (error) throw error
  return Array.isArray(data) ? (data as CollapsedZRpc[]) : []
}

async function loadRevenueRows(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<RevenueTxRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type, method, category, is_credit')
    .eq('store_id', storeId)
    .eq('type', 'income')
    .eq('is_credit', false)
    .gte('date', range.from)
    .lte('date', range.to)

  if (error) throw error
  return Array.isArray(data) ? (data as RevenueTxRow[]) : []
}

async function loadPeriodAggregate(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<PeriodAggregate> {
  const normalizedRange = {
    from: range.from,
    to: range.to,
  }

  const [summary, payroll, zRows, revenueRows] = await Promise.all([
    loadAnalysisSummary(supabase, storeId, normalizedRange),
    loadPayrollSummary(supabase, storeId, normalizedRange),
    loadCollapsedZ(supabase, storeId, normalizedRange),
    loadRevenueRows(supabase, storeId, normalizedRange),
  ])

  const filteredRevenueRows = revenueRows.filter((row) => !isTransferCategory(row.category))

  const revenueByDate: Record<string, number> = {}
  let cashRevenue = 0
  let cardRevenue = 0

  for (const row of filteredRevenueRows) {
    const date = String(row.date || '')
    if (!date) continue
    const amount = toNumber(row.amount)
    revenueByDate[date] = toNumber(revenueByDate[date]) + amount

    if (isCashMethod(row.method)) cashRevenue += amount
    else if (isCardMethod(row.method)) cardRevenue += amount
  }

  const zByDate: Record<string, number> = {}
  for (const row of zRows) {
    const date = String(row.date || '')
    if (!date) continue
    zByDate[date] = toNumber(zByDate[date]) + toNumber(row.total_z)
  }

  const totalRevenue = toNumber(summary.income)
  const transactionCount = filteredRevenueRows.length
  const days = countInclusiveDays(normalizedRange)

  return {
    range: normalizedRange,
    days,
    totalRevenue,
    cashRevenue,
    cardRevenue,
    transactionCount,
    averageTicket: transactionCount > 0 ? totalRevenue / transactionCount : 0,
    averageDailyRevenue: days > 0 ? totalRevenue / days : 0,
    expenses: toNumber(summary.expenses),
    profit: toNumber(summary.net_profit),
    payrollPct: toNumber(payroll.payroll_pct),
    zTotals: Object.values(zByDate).reduce((sum, value) => sum + toNumber(value), 0),
    creditTotals: toNumber(summary.credit_outstanding),
    revenueByDate,
    zByDate,
  }
}

function buildDailyRows(current: PeriodAggregate, previous: PeriodAggregate): FinancialComparisonDayRow[] {
  const currentKeys = enumerateDateKeys(current.range)
  const previousKeys = enumerateDateKeys(previous.range)
  const rows: FinancialComparisonDayRow[] = []
  let currentCumulativeRevenue = 0
  let previousCumulativeRevenue = 0

  for (let index = 0; index < currentKeys.length; index += 1) {
    const currentDate = currentKeys[index] || current.range.from
    const previousDate = previousKeys[index] || previous.range.from
    const currentRevenue = toNumber(current.revenueByDate[currentDate])
    const previousRevenue = toNumber(previous.revenueByDate[previousDate])
    const currentZTotal = toNumber(current.zByDate[currentDate])
    const previousZTotal = toNumber(previous.zByDate[previousDate])

    currentCumulativeRevenue += currentRevenue
    previousCumulativeRevenue += previousRevenue

    rows.push({
      offset: index,
      label: formatShortDateKey(currentDate),
      currentDate,
      previousDate,
      currentWeekday: getWeekdayLabel(currentDate),
      previousWeekday: getWeekdayLabel(previousDate),
      currentRevenue,
      previousRevenue,
      currentZTotal,
      previousZTotal,
      currentCumulativeRevenue,
      previousCumulativeRevenue,
    })
  }

  return rows
}

function buildWeekdayNormalizedRows(
  current: PeriodAggregate,
  previous: PeriodAggregate,
): FinancialComparisonWeekdayRow[] {
  const currentBuckets = new Map<string, { revenue: number; z: number; count: number }>()
  const previousBuckets = new Map<string, { revenue: number; z: number; count: number }>()

  for (const dateKey of enumerateDateKeys(current.range)) {
    const weekday = getWeekdayLabel(dateKey)
    const bucket = currentBuckets.get(weekday) ?? { revenue: 0, z: 0, count: 0 }
    bucket.revenue += toNumber(current.revenueByDate[dateKey])
    bucket.z += toNumber(current.zByDate[dateKey])
    bucket.count += 1
    currentBuckets.set(weekday, bucket)
  }

  for (const dateKey of enumerateDateKeys(previous.range)) {
    const weekday = getWeekdayLabel(dateKey)
    const bucket = previousBuckets.get(weekday) ?? { revenue: 0, z: 0, count: 0 }
    bucket.revenue += toNumber(previous.revenueByDate[dateKey])
    bucket.z += toNumber(previous.zByDate[dateKey])
    bucket.count += 1
    previousBuckets.set(weekday, bucket)
  }

  const weekdays = Array.from(new Set([...currentBuckets.keys(), ...previousBuckets.keys()]))
  weekdays.sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right))

  return weekdays.map((weekday) => {
    const currentBucket = currentBuckets.get(weekday) ?? { revenue: 0, z: 0, count: 0 }
    const previousBucket = previousBuckets.get(weekday) ?? { revenue: 0, z: 0, count: 0 }

    return {
      weekday,
      currentAverageRevenue:
        currentBucket.count > 0 ? currentBucket.revenue / currentBucket.count : 0,
      previousAverageRevenue:
        previousBucket.count > 0 ? previousBucket.revenue / previousBucket.count : 0,
      currentZTotal: currentBucket.z,
      previousZTotal: previousBucket.z,
    }
  })
}

export async function buildFinancialComparison(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<FinancialComparisonResponse> {
  const { current, previous, days } = getYearOverYearRanges(range)
  const [currentAggregate, previousAggregate] = await Promise.all([
    loadPeriodAggregate(supabase, storeId, current),
    loadPeriodAggregate(supabase, storeId, previous),
  ])

  return {
    periods: {
      current: {
        from: current.from,
        to: current.to,
        days,
        label: formatRangeLabel(current),
      },
      previous: {
        from: previous.from,
        to: previous.to,
        days: previousAggregate.days,
        label: formatRangeLabel(previous),
      },
    },
    summary: {
      totalRevenue: buildComparisonMetric(currentAggregate.totalRevenue, previousAggregate.totalRevenue),
      cashRevenue: buildComparisonMetric(currentAggregate.cashRevenue, previousAggregate.cashRevenue),
      cardRevenue: buildComparisonMetric(currentAggregate.cardRevenue, previousAggregate.cardRevenue),
      averageDailyRevenue: buildComparisonMetric(currentAggregate.averageDailyRevenue, previousAggregate.averageDailyRevenue),
      transactionCount: buildComparisonMetric(currentAggregate.transactionCount, previousAggregate.transactionCount),
      averageTicket: buildComparisonMetric(currentAggregate.averageTicket, previousAggregate.averageTicket),
      profit: buildComparisonMetric(currentAggregate.profit, previousAggregate.profit),
      expenses: buildComparisonMetric(currentAggregate.expenses, previousAggregate.expenses),
      payrollPct: buildComparisonMetric(currentAggregate.payrollPct, previousAggregate.payrollPct),
      zTotals: buildComparisonMetric(currentAggregate.zTotals, previousAggregate.zTotals),
      creditTotals: buildComparisonMetric(currentAggregate.creditTotals, previousAggregate.creditTotals),
    },
    daily: buildDailyRows(currentAggregate, previousAggregate),
    weekdayNormalized: buildWeekdayNormalizedRows(currentAggregate, previousAggregate),
    generatedAt: new Date().toISOString(),
  }
}
