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
import { enumerateDateKeys, formatRangeLabel, getYearOverYearRanges } from '@/lib/financialPeriods'

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
  const { fromDate, toDate, setFromDate, setToDate } = useEconomicsPeriod()
  const range = fromDate <= toDate ? { from: fromDate, to: toDate } : { from: toDate, to: fromDate }
  const yoy = getYearOverYearRanges(range)

  const historyRows = buildStubHistoryRows(range.from, range.to)

  const rangeRevenue = historyRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0)
  const rangeExpenses = historyRows.reduce((sum, row) => sum + (row.expenses ?? 0), 0)
  const rangeProfit = historyRows.reduce((sum, row) => sum + (row.profit ?? 0), 0)

  const rangeRevenuePrevYear = historyRows.reduce((sum, row) => sum + (row.revenuePrevYear ?? 0), 0)
  const rangeExpensesPrevYear = historyRows.reduce((sum, row) => sum + (row.expensesPrevYear ?? 0), 0)
  const rangeProfitPrevYear = historyRows.reduce((sum, row) => sum + (row.profitPrevYear ?? 0), 0)

  const lastRow = historyRows[0]

  const summaryStub: EconomicsHomeSummaryDto = {
    todayLabel: lastRow?.label || 'Σήμερα',
    todayRevenue: lastRow?.revenue,
    todayProfit: lastRow?.profit,
    monthRevenue: rangeRevenue,
    monthProfit: rangeProfit,
    cashRevenue: lastRow?.cashRevenue,
    cardRevenue: lastRow?.cardRevenue,
  }

  const delta = rangeRevenue - rangeRevenuePrevYear
  const deltaPct = rangeRevenuePrevYear === 0 ? null : (delta / Math.abs(rangeRevenuePrevYear)) * 100

  const comparisonStub: EconomicsComparisonDto = {
    periodLabel: formatRangeLabel(yoy.current),
    previousPeriodLabel: formatRangeLabel(yoy.previous),
    currentTotal: rangeRevenue,
    previousTotal: rangeRevenuePrevYear,
    delta,
    deltaPct,
  }

  const summary = mapHomeSummary(summaryStub)
  const comparison = mapComparisonSummary(comparisonStub)

  const displaySummary = buildHomeDisplay(summary, {
    yesterdayRevenue: historyRows[Math.max(0, historyRows.length - 2)]?.revenue,
    yesterdayProfit: historyRows[Math.max(0, historyRows.length - 2)]?.profit,
    lastMonthRevenue: rangeRevenuePrevYear,
    lastMonthProfit: rangeProfitPrevYear,
  })

  displaySummary.rangeLabel = formatRangeLabel(range)
  displaySummary.rangeFrom = range.from
  displaySummary.rangeTo = range.to
  displaySummary.rangeRevenue = rangeRevenue
  displaySummary.rangeExpenses = rangeExpenses
  displaySummary.rangeProfit = rangeProfit
  displaySummary.rangeRevenuePrevYear = rangeRevenuePrevYear
  displaySummary.rangeExpensesPrevYear = rangeExpensesPrevYear
  displaySummary.rangeProfitPrevYear = rangeProfitPrevYear
  displaySummary.historyRows = historyRows

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsHomeScreen
            summary={displaySummary}
            comparison={comparison}
            summaryLoading={false}
            comparisonLoading={false}
            fromDate={range.from}
            toDate={range.to}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}

function buildStubHistoryRows(from: string, to: string): EconomicsHistoryRowDto[] {
  const dateKeys = enumerateDateKeys({ from, to })

  return dateKeys
    .map((date, index) => {
      const wave = Math.sin(index / 2) * 140
      const trend = index * 38
      const revenue = Math.max(760, Math.round(1300 + wave + trend))
      const expenseBase = 0.42 + ((index % 5) * 0.05)
      const expenses = Math.round(revenue * Math.min(0.82, expenseBase))
      const profit = revenue - expenses
      const cashRevenue = Math.round(revenue * (0.38 + ((index % 3) * 0.08)))
      const cardRevenue = revenue - cashRevenue

      const revenuePrevYear = Math.round(revenue * (0.84 + ((index % 4) * 0.03)))
      const expensesPrevYear = Math.round(expenses * (0.9 + ((index % 3) * 0.04)))
      const profitPrevYear = revenuePrevYear - expensesPrevYear

      const [year, month, day] = date.split('-')
      const label = `${day}/${month}/${year}`

      return {
        date,
        label,
        revenue,
        expenses,
        profit,
        cashRevenue,
        cardRevenue,
        revenuePrevYear,
        expensesPrevYear,
        profitPrevYear,
      }
    })
    .reverse()
}
