export type ComparisonTrend = 'up' | 'down' | 'flat'

export type FinancialMetricComparison = {
  current: number
  previous: number
  delta: number
  deltaPct: number | null
  trend: ComparisonTrend
}

export type FinancialComparisonSummary = {
  totalRevenue: FinancialMetricComparison
  cashRevenue: FinancialMetricComparison
  cardRevenue: FinancialMetricComparison
  averageDailyRevenue: FinancialMetricComparison
  transactionCount: FinancialMetricComparison
  averageTicket: FinancialMetricComparison
  profit: FinancialMetricComparison
  expenses: FinancialMetricComparison
  payrollPct: FinancialMetricComparison
  zTotals: FinancialMetricComparison
  creditTotals: FinancialMetricComparison
}

export type FinancialComparisonPeriod = {
  from: string
  to: string
  days: number
  label: string
}

export type FinancialComparisonDayRow = {
  offset: number
  label: string
  currentDate: string
  previousDate: string
  currentWeekday: string
  previousWeekday: string
  currentRevenue: number
  previousRevenue: number
  currentZTotal: number
  previousZTotal: number
  currentCumulativeRevenue: number
  previousCumulativeRevenue: number
}

export type FinancialComparisonWeekdayRow = {
  weekday: string
  currentAverageRevenue: number
  previousAverageRevenue: number
  currentZTotal: number
  previousZTotal: number
}

export type FinancialComparisonResponse = {
  periods: {
    current: FinancialComparisonPeriod
    previous: FinancialComparisonPeriod
  }
  summary: FinancialComparisonSummary
  daily: FinancialComparisonDayRow[]
  weekdayNormalized: FinancialComparisonWeekdayRow[]
  generatedAt: string
}
