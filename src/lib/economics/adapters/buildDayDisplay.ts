/**
 * Build enriched day display DTOs.
 * Combines canonical day detail with comparison context.
 */

import type { EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsDayDisplayDto } from '@/lib/economics/types/economicsDisplay'
import {
  compareDayVsYesterday,
  compareDayVsLastYear,
  compareDayVsWeekdayAvg,
  marginConfidence,
} from './compareDay'

export type DayComparisonContext = {
  yesterday?: EconomicsDayDetailDto | null
  lastYear?: EconomicsDayDetailDto | null
  weekdayAvgRevenue?: number
  weekdayAvgProfit?: number
  monthAvgExpenseRatio?: number
}

/**
 * Build a display DTO with full comparison context.
 */
export function buildDayDisplay(
  detail: EconomicsDayDetailDto,
  context: DayComparisonContext = {},
): EconomicsDayDisplayDto {
  const s = detail.summary

  // Compute all comparisons
  const vsYesterday = compareDayVsYesterday(detail, context.yesterday ?? null)
  const vsLastYear = compareDayVsLastYear(detail, context.lastYear ?? null)
  const vsWeekdayAvg = compareDayVsWeekdayAvg(
    detail,
    context.weekdayAvgRevenue,
    context.weekdayAvgProfit,
  )

  // Operational signals
  const todayExpenses = (s?.todayRevenue ?? 0) - (s?.todayProfit ?? 0)
  const margin = marginConfidence(s?.todayProfit, s?.todayRevenue)

  // Derive "biggest expense" and "transaction count" from transactions
  const expenses = detail.transactions.filter((t) => t.isCredit !== true)
  const topExpense = expenses.reduce<typeof expenses[0] | null>(
    (best, t) => (best === null || t.amount > best.amount ? t : best),
    null,
  )

  const catCounts: Record<string, number> = {}
  for (const t of expenses) {
    const cat = t.category ?? t.type ?? 'Άλλο'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const topExpenseCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    date: detail.date,
    label: detail.label,
    revenue: s?.todayRevenue,
    expenses: todayExpenses,
    profit: s?.todayProfit,
    // Comparisons
    yesterdayRevenue: context.yesterday?.summary?.todayRevenue,
    yesterdayProfit: context.yesterday?.summary?.todayProfit,
    yearAgoRevenue: context.lastYear?.summary?.todayRevenue,
    yearAgoProfit: context.lastYear?.summary?.todayProfit,
    weekdayAvgRevenue: context.weekdayAvgRevenue,
    weekdayAvgProfit: context.weekdayAvgProfit,
    // Deltas
    revenueVsYesterdayPct: vsYesterday.revenueVsYesterdayPct,
    profitVsYesterdayPct: vsYesterday.profitVsYesterdayPct,
    revenueVsYearAgoPct: vsLastYear.revenueVsLastYearPct,
    profitVsYearAgoPct: vsLastYear.profitVsLastYearPct,
    // Context
    topExpenseAmount: topExpense?.amount,
    topExpenseCategory,
    transactionCount: detail.transactions.length,
    cashRevenue: s?.cashRevenue,
    cardRevenue: s?.cardRevenue,
    isToday: detail.date === new Date().toISOString().slice(0, 10),
  }
}
