/**
 * Day comparison engine — compute business story from canonical outputs.
 * 
 * Pure functions that build operational context from existing canonical data.
 * Never modifies canonical layer.
 * Used by display-layer adapters to enrich surfaces.
 */

import type { EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsDayDisplayDto } from '@/lib/economics/types/economicsDisplay'

// ─── Comparison computations ──────────────────────────────────────────────

/**
 * Compare a day against yesterday.
 * Inputs come from canonical layer (fetched separately).
 */
export function compareDayVsYesterday(
  today: EconomicsDayDetailDto,
  yesterday: EconomicsDayDetailDto | null,
): {
  revenueVsYesterday?: number
  revenueVsYesterdayPct?: number
  expenseVsYesterday?: number
  expenseVsYesterdayPct?: number
  profitVsYesterday?: number
  profitVsYesterdayPct?: number
} {
  if (!yesterday) return {}

  const todayExpenses = (today.summary?.todayRevenue ?? 0) - (today.summary?.todayProfit ?? 0)
  const yesterdayExpenses = (yesterday.summary?.todayRevenue ?? 0) - (yesterday.summary?.todayProfit ?? 0)

  const revenueVsYesterday = (today.summary?.todayRevenue ?? 0) - (yesterday.summary?.todayRevenue ?? 0)
  const revenueVsYesterdayPct =
    (yesterday.summary?.todayRevenue ?? 0) > 0
      ? Math.round((revenueVsYesterday / (yesterday.summary?.todayRevenue ?? 0)) * 100)
      : undefined

  const expenseVsYesterday = todayExpenses - yesterdayExpenses
  const expenseVsYesterdayPct =
    yesterdayExpenses > 0
      ? Math.round((expenseVsYesterday / yesterdayExpenses) * 100)
      : undefined

  const profitVsYesterday = (today.summary?.todayProfit ?? 0) - (yesterday.summary?.todayProfit ?? 0)
  const profitVsYesterdayPct =
    (yesterday.summary?.todayProfit ?? 0) !== 0
      ? Math.round((profitVsYesterday / Math.abs(yesterday.summary?.todayProfit ?? 1)) * 100)
      : undefined

  return {
    revenueVsYesterday,
    revenueVsYesterdayPct,
    expenseVsYesterday,
    expenseVsYesterdayPct,
    profitVsYesterday,
    profitVsYesterdayPct,
  }
}

/**
 * Compare a day against same day last year.
 */
export function compareDayVsLastYear(
  today: EconomicsDayDetailDto,
  lastYear: EconomicsDayDetailDto | null,
): {
  revenueVsLastYear?: number
  revenueVsLastYearPct?: number
  profitVsLastYear?: number
  profitVsLastYearPct?: number
} {
  if (!lastYear) return {}

  const revenueVsLastYear = (today.summary?.todayRevenue ?? 0) - (lastYear.summary?.todayRevenue ?? 0)
  const revenueVsLastYearPct =
    (lastYear.summary?.todayRevenue ?? 0) > 0
      ? Math.round((revenueVsLastYear / (lastYear.summary?.todayRevenue ?? 0)) * 100)
      : undefined

  const profitVsLastYear = (today.summary?.todayProfit ?? 0) - (lastYear.summary?.todayProfit ?? 0)
  const profitVsLastYearPct =
    (lastYear.summary?.todayProfit ?? 0) !== 0
      ? Math.round((profitVsLastYear / Math.abs(lastYear.summary?.todayProfit ?? 1)) * 100)
      : undefined

  return {
    revenueVsLastYear,
    revenueVsLastYearPct,
    profitVsLastYear,
    profitVsLastYearPct,
  }
}

/**
 * Compare against weekday average.
 */
export function compareDayVsWeekdayAvg(
  today: EconomicsDayDetailDto,
  weekdayAvgRevenue: number | undefined,
  weekdayAvgProfit: number | undefined,
): {
  revenueVsWeekdayAvg?: number
  revenueVsWeekdayAvgPct?: number
  profitVsWeekdayAvg?: number
  profitVsWeekdayAvgPct?: number
} {
  const result: any = {}

  if (weekdayAvgRevenue !== undefined) {
    result.revenueVsWeekdayAvg = (today.summary?.todayRevenue ?? 0) - weekdayAvgRevenue
    if (weekdayAvgRevenue > 0) {
      result.revenueVsWeekdayAvgPct = Math.round((result.revenueVsWeekdayAvg / weekdayAvgRevenue) * 100)
    }
  }

  if (weekdayAvgProfit !== undefined) {
    result.profitVsWeekdayAvg = (today.summary?.todayProfit ?? 0) - weekdayAvgProfit
    if (weekdayAvgProfit !== 0) {
      result.profitVsWeekdayAvgPct = Math.round((result.profitVsWeekdayAvg / Math.abs(weekdayAvgProfit)) * 100)
    }
  }

  return result
}

// ─── Operational signals (light interpretation) ──────────────────────────

/**
 * Detect if expenses are unusually high.
 */
export function isHighExpenseDay(
  todayRevenue: number | undefined,
  todayExpenses: number | undefined,
  monthAvgExpenseRatio: number | undefined,
): boolean {
  if (!todayRevenue || !todayExpenses || todayRevenue === 0) return false
  const ratio = todayExpenses / todayRevenue
  const threshold = monthAvgExpenseRatio ? monthAvgExpenseRatio + 0.1 : 0.75
  return ratio > threshold
}

/**
 * Margin confidence: strong (>30%), weak (0-30%), bad (<0%).
 */
export function marginConfidence(profit: number | undefined, revenue: number | undefined): 'strong' | 'weak' | 'bad' {
  if (profit === undefined || revenue === undefined || revenue === 0) return 'weak'
  const ratio = profit / revenue
  return ratio > 0.3 ? 'strong' : ratio >= 0 ? 'weak' : 'bad'
}

/**
 * Simple signal: is this day notably different from recent average?
 */
export function isOutlierDay(
  dayValue: number | undefined,
  avgValue: number | undefined,
  threshold: number = 0.2, // 20% difference
): boolean {
  if (dayValue === undefined || avgValue === undefined || avgValue === 0) return false
  const diff = Math.abs(dayValue - avgValue) / avgValue
  return diff > threshold
}
