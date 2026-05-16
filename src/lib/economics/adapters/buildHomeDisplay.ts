/**
 * Build enriched home display DTOs.
 * Adds yesterday and last-year context to home summary.
 */

import type { EconomicsHomeSummaryDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsHomeDisplayDto } from '@/lib/economics/types/economicsDisplay'

export type HomeComparisonContext = {
  yesterdayRevenue?: number
  yesterdayProfit?: number
  lastMonthRevenue?: number
  lastMonthProfit?: number
  monthAvgExpenseRatio?: number
}

/**
 * Build a home display DTO with comparison context.
 */
export function buildHomeDisplay(
  summary: EconomicsHomeSummaryDto,
  context: HomeComparisonContext = {},
): EconomicsHomeDisplayDto {
  const revenueVsYesterday =
    summary.todayRevenue !== undefined && context.yesterdayRevenue !== undefined
      ? summary.todayRevenue - context.yesterdayRevenue
      : undefined

  const profitVsYesterday =
    summary.todayProfit !== undefined && context.yesterdayProfit !== undefined
      ? summary.todayProfit - context.yesterdayProfit
      : undefined

  // Month expense pressure (%)
  const monthExpenses = (summary.monthRevenue ?? 0) - (summary.monthProfit ?? 0)
  const monthExpensePressure =
    summary.monthRevenue !== undefined && summary.monthRevenue > 0
      ? Math.round((monthExpenses / summary.monthRevenue) * 100)
      : undefined

  return {
    ...summary,
    yesterdayRevenue: context.yesterdayRevenue,
    yesterdayProfit: context.yesterdayProfit,
    revenueVsYesterday,
    profitVsYesterday,
    monthExpensePressure,
  }
}
