/**
 * Display-layer types for economics surfaces.
 * 
 * These are NOT canonical — they're surface presentation shapes
 * built from canonical DTOs + computed context.
 * 
 * Never persisted. Never used in business logic.
 * Only for UI presentation and timeline narrative.
 */

import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from './economicsDto'

/**
 * Home display: Today + Yesterday context.
 * Enriches the canonical summary with comparison narrative.
 */
export type EconomicsHomeDisplayDto = EconomicsHomeSummaryDto & {
  /** Yesterday's revenue (for comparison narrative) */
  yesterdayRevenue?: number
  /** Yesterday's profit (for comparison narrative) */
  yesterdayProfit?: number
  /** Revenue delta vs yesterday (computed) */
  revenueVsYesterday?: number
  /** Profit delta vs yesterday (computed) */
  profitVsYesterday?: number
  /** Month best day label */
  monthBestDayRevenue?: number
  /** Month worst day label */
  monthWorstDayRevenue?: number
  /** Expense pressure this month (computed %) */
  monthExpensePressure?: number
}

/**
 * Day display: Full business story.
 * Wraps canonical day detail with comparison context.
 */
export type EconomicsDayDisplayDto = {
  date: string
  label?: string
  revenue?: number
  expenses?: number
  profit?: number
  /** vs yesterday revenue */
  yesterdayRevenue?: number
  /** vs yesterday profit */
  yesterdayProfit?: number
  /** vs same day last year revenue */
  yearAgoRevenue?: number
  /** vs same day last year profit */
  yearAgoProfit?: number
  /** vs average for same weekday this month */
  weekdayAvgRevenue?: number
  /** vs average for same weekday this month */
  weekdayAvgProfit?: number
  /** Revenue change % vs yesterday */
  revenueVsYesterdayPct?: number
  /** Profit change % vs yesterday */
  profitVsYesterdayPct?: number
  /** Revenue change % vs year ago */
  revenueVsYearAgoPct?: number
  /** Profit change % vs year ago */
  profitVsYearAgoPct?: number
  /** biggest expense (computed) */
  topExpenseAmount?: number
  topExpenseCategory?: string
  /** transaction count */
  transactionCount?: number
  /** cash vs card breakdown */
  cashRevenue?: number
  cardRevenue?: number
  /** is today? */
  isToday?: boolean
}

/**
 * Calendar display: Each day with visual/operational signals.
 */
export type EconomicsCalendarDisplayDayDto = {
  date: string
  label?: string
  revenue?: number
  expenses?: number
  profit?: number
  status?: 'strong' | 'weak' | 'neutral' | 'empty'
  isToday?: boolean
  isSelected?: boolean
  hasAnomaly?: boolean
  /** high expense ratio indicator (expenses/revenue > 72%) */
  isHighExpenseDay?: boolean
  /** profit negative indicator */
  isProfitNegative?: boolean
  /** margin confidence: 'strong' (>30%), 'weak' (0-30%), 'bad' (<0%) */
  marginConfidence?: 'strong' | 'weak' | 'bad'
}
