'use client'

import React, { Suspense } from 'react'
import { EconomicsHomeScreen } from '@/components/economics/home'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import { mapHomeSummary } from '@/lib/economics/adapters/mapHomeSummary'
import { mapComparisonSummary } from '@/lib/economics/adapters/mapComparisonSummary'
import { buildHomeDisplay } from '@/lib/economics/adapters/buildHomeDisplay'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsHistoryRowDto } from '@/lib/economics/types/economicsDisplay'
import { useEconomicsPeriod } from '@/components/economics/shell/EconomicsPeriodProvider'
import { formatRangeLabel, getYearOverYearRanges } from '@/lib/financialPeriods'
import { useEconomicsShell } from '@/components/economics/shell/EconomicsShellProvider'
import { useCanonicalFinancialPeriod } from '@/hooks/useCanonicalFinancialPeriod'
import { useAnalysisComparison } from '@/hooks/useAnalysisComparison'
import {
  isCardLikeMethod,
  isCashLikeMethod,
  isExpenseTransaction,
  isRevenueTransaction,
  toAmount,
  type CanonicalFinancialRow,
} from '@/lib/canonicalFinancialMetrics'

/**
 * Route adapter for /economics/income (home view).
 *
 * This is a thin wrapper that:
 * - bridges the old /economics/income route to the new home surface
 * - enriches canonical data with display-layer comparisons
 * - preserves the old route for deep links and browser history
 * - does NOT change finance semantics
 * - relies on the same canonical layer for all calculations
 *
 * Data is mocked here (stubs) — real integration happens via adapters.
 */
export function IncomeRouteAdapter() {
  const { storeId } = useEconomicsShell()
  const { fromDate, toDate, setFromDate, setToDate } = useEconomicsPeriod()
  const range = fromDate <= toDate ? { from: fromDate, to: toDate } : { from: toDate, to: fromDate }
  const yoy = getYearOverYearRanges(range)

  const canonical = useCanonicalFinancialPeriod({
    storeId,
    range,
    enabled: Boolean(storeId),
  })

  const comparisonData = useAnalysisComparison({
    storeId,
    fromDate: range.from,
    toDate: range.to,
    enabled: Boolean(storeId),
  })

  const historyRows = buildHistoryRowsFromCanonical(canonical.rows)

  const rangeRevenue = canonical.summary?.totalRevenue
  const rangeExpenses = canonical.summary?.totalExpenses
  const rangeProfit = canonical.summary?.profit

  const lastRow = historyRows[0]

  const summaryStub: EconomicsHomeSummaryDto | null = canonical.summary
    ? {
        todayLabel: lastRow?.label || 'Σήμερα',
        todayRevenue: lastRow?.revenue,
        todayProfit: lastRow?.profit,
        monthRevenue: canonical.summary.totalRevenue,
        monthProfit: canonical.summary.profit,
        cashRevenue: canonical.summary.cashRevenue,
        cardRevenue: canonical.summary.cardRevenue,
      }
    : null

  // Check if comparison data exists and has valid summary (not checking daily rows to avoid false negatives)
  const hasCanonicalComparison = Boolean(
    comparisonData.data?.summary?.totalRevenue?.previous !== undefined &&
      comparisonData.data?.summary?.totalRevenue?.current !== undefined,
  )

  if (process.env.NODE_ENV !== 'production') {
    if (comparisonData.loading || comparisonData.error || !hasCanonicalComparison) {
      console.debug('[economics/income] Comparison state:', {
        storeId,
        period: { from: range.from, to: range.to },
        isLoading: comparisonData.loading,
        hasError: Boolean(comparisonData.error),
        errorMessage: comparisonData.error,
        hasComparison: hasCanonicalComparison,
        responseStructure: {
          hasSummary: Boolean(comparisonData.data?.summary),
          totalRevenueMetric: comparisonData.data?.summary?.totalRevenue,
          dailyCount: comparisonData.data?.daily?.length || 0,
        },
      })
    }
  }

  const canonicalRevenueComparison = hasCanonicalComparison
    ? comparisonData.data?.summary?.totalRevenue
    : null

  const canonicalExpensesComparison = hasCanonicalComparison
    ? comparisonData.data?.summary?.expenses
    : null

  const canonicalProfitComparison = hasCanonicalComparison
    ? comparisonData.data?.summary?.profit
    : null

  // Build comparison lookup map for per-day Y-o-Y data
  const dailyComparisonMap = new Map<string, (typeof comparisonData.data.daily)[number]>()
  if (hasCanonicalComparison && comparisonData.data?.daily) {
    for (const dailyRow of comparisonData.data.daily) {
      dailyComparisonMap.set(dailyRow.currentDate, dailyRow)
    }
  }

  // Enrich history rows with per-day comparison data
  const enrichedHistoryRows = historyRows.map((row) => {
    const dailyComparison = dailyComparisonMap.get(row.date)
    return {
      ...row,
      revenuePrevYear: dailyComparison?.previousRevenue,
      expensesPrevYear: dailyComparison ? undefined : undefined,
      profitPrevYear: undefined,
    }
  })

  const comparisonStub: EconomicsComparisonDto | null = canonicalRevenueComparison
    ? {
        periodLabel: comparisonData.data?.periods.current.label,
        previousPeriodLabel: comparisonData.data?.periods.previous.label,
        currentTotal: canonicalRevenueComparison.current,
        previousTotal: canonicalRevenueComparison.previous,
        delta: canonicalRevenueComparison.delta,
        deltaPct: canonicalRevenueComparison.deltaPct,
      }
    : null

  const summary = summaryStub ? mapHomeSummary(summaryStub) : null
  const comparison = comparisonStub ? mapComparisonSummary(comparisonStub) : null

  const displaySummary = summary
    ? buildHomeDisplay(summary, {
        yesterdayRevenue: historyRows[Math.max(0, historyRows.length - 2)]?.revenue,
        yesterdayProfit: historyRows[Math.max(0, historyRows.length - 2)]?.profit,
      })
    : null

  if (displaySummary) {
    displaySummary.rangeLabel = formatRangeLabel(range)
    displaySummary.rangeFrom = range.from
    displaySummary.rangeTo = range.to
    displaySummary.rangeRevenue = rangeRevenue
    displaySummary.rangeExpenses = rangeExpenses
    displaySummary.rangeProfit = rangeProfit
    displaySummary.rangeRevenuePrevYear = canonicalRevenueComparison?.previous
    displaySummary.rangeExpensesPrevYear = canonicalExpensesComparison?.previous
    displaySummary.rangeProfitPrevYear = canonicalProfitComparison?.previous
    displaySummary.rangeRevenueDeltaPct = canonicalRevenueComparison?.deltaPct
    displaySummary.rangeExpensesDeltaPct = canonicalExpensesComparison?.deltaPct
    displaySummary.rangeProfitDeltaPct = canonicalProfitComparison?.deltaPct
    displaySummary.noComparisonData = !hasCanonicalComparison
    displaySummary.historyRows = enrichedHistoryRows
  }

  if (canonical.summary && displaySummary) {
    const summedRevenue = historyRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0)
    const mismatch = Math.abs(summedRevenue - canonical.summary.totalRevenue) > 0.0001
    if (mismatch) {
      console.error('[economics][invariant] revenue mismatch', {
        canonicalRevenue: canonical.summary.totalRevenue,
        timelineRevenue: summedRevenue,
      })
    }
  }

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsHomeScreen
            summary={displaySummary}
            comparison={comparison}
            summaryLoading={canonical.loading}
            comparisonLoading={comparisonData.loading}
            fromDate={range.from}
            toDate={range.to}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            comparisonError={comparisonData.error}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}

function buildHistoryRowsFromCanonical(rows: CanonicalFinancialRow[]): EconomicsHistoryRowDto[] {
  const byDate = new Map<string, EconomicsHistoryRowDto>()

  for (const row of rows) {
    const amount = toAmount(row.amount)
    const absAmount = Math.abs(amount)
    const method = String(row.payment_method ?? row.method ?? '')
    const existing = byDate.get(row.date) || { date: row.date, label: formatDateLabel(row.date), revenue: 0, expenses: 0, profit: 0, cashRevenue: 0, cardRevenue: 0 }

    if (isRevenueTransaction(row)) {
      existing.revenue = (existing.revenue || 0) + amount
      if (isCashLikeMethod(method)) existing.cashRevenue = (existing.cashRevenue || 0) + amount
      if (isCardLikeMethod(method)) existing.cardRevenue = (existing.cardRevenue || 0) + amount
    } else if (isExpenseTransaction(row)) {
      existing.expenses = (existing.expenses || 0) + absAmount
    }

    existing.profit = (existing.revenue || 0) - (existing.expenses || 0)
    byDate.set(row.date, existing)
  }

  return Array.from(byDate.values()).sort((left, right) => right.date.localeCompare(left.date))
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-')
  return `${day}/${month}/${year}`
}
