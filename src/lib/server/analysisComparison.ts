import type { SupabaseClient } from '@supabase/supabase-js'
import {
  aggregateCanonicalFinancialMetrics,
  type CanonicalFinancialRow,
} from '@/lib/canonicalFinancialMetrics'
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

const WEEKDAY_ORDER = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ']

type PayrollPeriodRpc = {
  payroll_pct?: number | null
}

type PeriodAggregate = {
  range: FinancialDateRange
  days: number
  rowCount: number
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

async function loadPeriodTransactions(
  supabase: SupabaseClient,
  storeId: string,
  range: FinancialDateRange,
): Promise<CanonicalFinancialRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type, category, method, payment_method, notes, is_credit')
    .eq('store_id', storeId)
    .gte('date', range.from)
    .lte('date', range.to)

  if (error) throw error
  return Array.isArray(data) ? (data as CanonicalFinancialRow[]) : []
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

  const [payroll, rows] = await Promise.all([
    loadPayrollSummary(supabase, storeId, normalizedRange),
    loadPeriodTransactions(supabase, storeId, normalizedRange),
  ])

  const days = countInclusiveDays(normalizedRange)
  const summary = aggregateCanonicalFinancialMetrics(rows, {
    range: normalizedRange,
    payrollPct: toNumber(payroll.payroll_pct),
  })

  return {
    range: normalizedRange,
    days,
    rowCount: rows.length,
    totalRevenue: summary.totalRevenue,
    cashRevenue: summary.cashRevenue,
    cardRevenue: summary.cardRevenue,
    transactionCount: summary.transactionCount,
    averageTicket: summary.averageTicket,
    averageDailyRevenue: days > 0 ? summary.totalRevenue / days : 0,
    expenses: summary.totalExpenses,
    profit: summary.profit,
    payrollPct: summary.payrollPct,
    zTotals: summary.zTotals,
    creditTotals: summary.credits,
    revenueByDate: summary.revenueByDate,
    zByDate: summary.zByDate,
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

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[comparison/build] range-mapping', {
      selectedStoreId: storeId,
      selectedPeriod: current,
      comparisonPeriod: previous,
      selectedComparisonDate: current.from,
      mappedComparisonDate: previous.from,
      dayCount: days,
    })
  }

  const [currentAggregate, previousAggregate] = await Promise.all([
    loadPeriodAggregate(supabase, storeId, current),
    loadPeriodAggregate(supabase, storeId, previous),
  ])

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[comparison/build] canonical-aggregate', {
      selectedStoreId: storeId,
      current: {
        range: currentAggregate.range,
        rowCount: currentAggregate.rowCount,
        totalRevenue: currentAggregate.totalRevenue,
        expenses: currentAggregate.expenses,
        profit: currentAggregate.profit,
        zTotals: currentAggregate.zTotals,
      },
      previous: {
        range: previousAggregate.range,
        rowCount: previousAggregate.rowCount,
        totalRevenue: previousAggregate.totalRevenue,
        expenses: previousAggregate.expenses,
        profit: previousAggregate.profit,
        zTotals: previousAggregate.zTotals,
      },
      noPreviousRows: previousAggregate.rowCount === 0,
    })
  }

  const response: FinancialComparisonResponse = {
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

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[comparison/build] adapter-result', {
      selectedStoreId: storeId,
      hasSummary: Boolean(response.summary),
      dailyRows: response.daily.length,
      selectedComparisonDate: current.from,
      mappedComparisonDate:
        response.daily.find((row) => row.currentDate === current.from)?.previousDate || previous.from,
      nullReason:
        previousAggregate.rowCount === 0
          ? 'no_previous_period_rows'
          : response.daily.length === 0
            ? 'no_daily_rows'
            : null,
    })
  }

  return response
}
