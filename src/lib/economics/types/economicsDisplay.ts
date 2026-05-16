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
  /** Active range label for timeline rendering */
  rangeLabel?: string
  /** Selected range from date key */
  rangeFrom?: string
  /** Selected range to date key */
  rangeTo?: string
  /** Revenue total in selected range */
  rangeRevenue?: number
  /** Expense total in selected range */
  rangeExpenses?: number
  /** Net total in selected range */
  rangeProfit?: number
  /** Previous year revenue for same day span */
  rangeRevenuePrevYear?: number
  /** Previous year expense for same day span */
  rangeExpensesPrevYear?: number
  /** Previous year net for same day span */
  rangeProfitPrevYear?: number
  /** Revenue delta pct from canonical comparison pipeline */
  rangeRevenueDeltaPct?: number | null
  /** Expense delta pct from canonical comparison pipeline */
  rangeExpensesDeltaPct?: number | null
  /** Profit delta pct from canonical comparison pipeline */
  rangeProfitDeltaPct?: number | null
  /** True when previous-year comparison is not available canonically */
  noComparisonData?: boolean
  /** Ordered daily rows for the active range */
  historyRows?: EconomicsHistoryRowDto[]
}

export type EconomicsHistoryRowDto = {
  date: string
  label?: string
  revenue?: number
  expenses?: number
  profit?: number
  cashRevenue?: number
  cardRevenue?: number
  revenuePrevYear?: number
  expensesPrevYear?: number
  profitPrevYear?: number
  revenueDeltaPct?: number | null
  expensesDeltaPct?: number | null
  profitDeltaPct?: number | null
  previousYearDate?: string
  hasPreviousYearData?: boolean
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
