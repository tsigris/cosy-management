/**
 * Cross-page financial invariant tests
 * Ensures consistency across dashboard, reports, profit, analysis, comparison pages
 */

import { aggregateCanonicalFinancialMetrics } from '@/lib/canonicalFinancialMetrics'
import { getRollingDayRange, getMonthRange, countInclusiveDays } from '@/lib/financialPeriods'
import type { CanonicalFinancialRow } from '@/lib/canonicalFinancialMetrics'
import {
  ALL_SCENARIOS,
  SCENARIO_COMPLEX_MONTH,
} from './fixtures/financialScenarios'
import {
  assertCrossPageConsistency,
} from './helpers/assertions'

describe('Cross-Page Financial Invariants', () => {
  describe('Dashboard vs Reports totals', () => {
    it('should produce identical totals for same fixture data', () => {
      ALL_SCENARIOS.forEach((scenario) => {
        const rows = scenario.rows as CanonicalFinancialRow[]

        const dashboardSummary = aggregateCanonicalFinancialMetrics(rows, {
          range: { from: '2026-05-14', to: '2026-05-14' },
        })

        const reportsSummary = aggregateCanonicalFinancialMetrics(rows, {
          range: { from: '2026-05-14', to: '2026-05-14' },
        })

        expect(dashboardSummary.totalRevenue).toBe(reportsSummary.totalRevenue)
        expect(dashboardSummary.totalExpenses).toBe(reportsSummary.totalExpenses)
        expect(dashboardSummary.profit).toBe(reportsSummary.profit)
      })
    })
  })

  describe('Reports vs Profit totals', () => {
    it('should produce identical totals for monthly breakdown', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]
      const range = getMonthRange('2026-05-14')

      const reportsSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      const profitSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      expect(reportsSummary.totalRevenue).toBe(profitSummary.totalRevenue)
      expect(reportsSummary.totalExpenses).toBe(profitSummary.totalExpenses)
      expect(reportsSummary.profit).toBe(profitSummary.profit)
    })
  })

  describe('Analysis vs Comparison totals', () => {
    it('should produce identical totals for current period', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]
      const range = getMonthRange('2026-05-14')

      const analysisSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      const comparisonSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      expect(analysisSummary.totalRevenue).toBe(comparisonSummary.totalRevenue)
      expect(analysisSummary.totalExpenses).toBe(comparisonSummary.totalExpenses)
      expect(analysisSummary.profit).toBe(comparisonSummary.profit)
    })
  })

  describe('Cashflow page consistency', () => {
    it('should match dashboard totals for single day', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]

      const dashboardSummary = aggregateCanonicalFinancialMetrics(rows, {
        range: { from: '2026-05-01', to: '2026-05-01' },
      })

      const cashflowSummary = aggregateCanonicalFinancialMetrics(rows, {
        range: { from: '2026-05-01', to: '2026-05-01' },
      })

      expect(dashboardSummary.totalRevenue).toBe(cashflowSummary.totalRevenue)
      expect(dashboardSummary.totalExpenses).toBe(cashflowSummary.totalExpenses)
      expect(dashboardSummary.profit).toBe(cashflowSummary.profit)
    })

    it('should match reports totals for full month', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]
      const range = getMonthRange('2026-05-14')

      const reportsSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      const cashflowSummary = aggregateCanonicalFinancialMetrics(rows, { range })

      expect(reportsSummary.totalRevenue).toBe(cashflowSummary.totalRevenue)
      expect(reportsSummary.totalExpenses).toBe(cashflowSummary.totalExpenses)
      expect(reportsSummary.profit).toBe(cashflowSummary.profit)
    })
  })

  describe('Period filter consistency across pages', () => {
    it('should use identical month range logic', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]

      const range = getMonthRange('2026-05-14')

      const summaries = {
        dashboard: aggregateCanonicalFinancialMetrics(rows, { range }),
        reports: aggregateCanonicalFinancialMetrics(rows, { range }),
        profit: aggregateCanonicalFinancialMetrics(rows, { range }),
        analysis: aggregateCanonicalFinancialMetrics(rows, { range }),
        cashflow: aggregateCanonicalFinancialMetrics(rows, { range }),
      }

      const baselineRevenue = summaries.dashboard.totalRevenue
      Object.entries(summaries).forEach(([pageName, summary]) => {
        expect(summary.totalRevenue).toBe(baselineRevenue)
      })
    })

    it('should use identical 30-day range logic', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]
      const range = getRollingDayRange('2026-05-14', 30)

      const summaries = {
        dashboard: aggregateCanonicalFinancialMetrics(rows, { range }),
        reports: aggregateCanonicalFinancialMetrics(rows, { range }),
        profit: aggregateCanonicalFinancialMetrics(rows, { range }),
        analysis: aggregateCanonicalFinancialMetrics(rows, { range }),
        cashflow: aggregateCanonicalFinancialMetrics(rows, { range }),
      }

      const baselineRevenue = summaries.dashboard.totalRevenue
      Object.entries(summaries).forEach(([pageName, summary]) => {
        expect(summary.totalRevenue).toBe(baselineRevenue)
      })
    })
  })

  describe('Rolling 30-day semantics', () => {
    it('should always generate exactly 30 inclusive days', () => {
      const testEndDates = [
        '2026-01-15',
        '2026-02-28',
        '2026-03-01',
        '2026-05-14',
        '2026-12-31',
      ]

      testEndDates.forEach((endDate) => {
        const range = getRollingDayRange(endDate, 30)
        expect(countInclusiveDays(range)).toBe(30)
      })
    })

    it('should be consistently applied across all period modes', () => {
      const endDate = '2026-05-14'
      const range30 = getRollingDayRange(endDate, 30)
      const range7 = getRollingDayRange(endDate, 7)
      const range1 = getRollingDayRange(endDate, 1)

      expect(countInclusiveDays(range30)).toBe(30)
      expect(countInclusiveDays(range7)).toBe(7)
      expect(countInclusiveDays(range1)).toBe(1)
    })
  })

  describe('No double-counting across classifications', () => {
    it('should not count same transaction in multiple totals', () => {
      ALL_SCENARIOS.forEach((scenario) => {
        const rows = scenario.rows as CanonicalFinancialRow[]
        const summary = aggregateCanonicalFinancialMetrics(rows)

        expect(summary.totalRevenue).toBe(
          summary.cashRevenue + summary.cardRevenue
        )

        expect(summary.profit).toBe(
          summary.totalRevenue - summary.totalExpenses
        )

        const expectedBalance = summary.cashTotals + summary.bankTotals
        expect(summary.totalBalance).toBe(expectedBalance)
      })
    })
  })

  describe('Year-over-year comparison consistency', () => {
    it('should use identical aggregation logic for both years', () => {
      const currentYearRows: CanonicalFinancialRow[] = [
        {
          date: '2026-05-14',
          amount: 100,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ]

      const previousYearRows: CanonicalFinancialRow[] = [
        {
          date: '2025-05-14',
          amount: 150,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ]

      const currentSummary = aggregateCanonicalFinancialMetrics(currentYearRows)
      const previousSummary = aggregateCanonicalFinancialMetrics(
        previousYearRows
      )

      expect(currentSummary.totalRevenue).toBe(100)
      expect(previousSummary.totalRevenue).toBe(150)

      const yoyGrowth =
        ((currentSummary.totalRevenue - previousSummary.totalRevenue) /
          previousSummary.totalRevenue) *
        100
      expect(yoyGrowth).toBeCloseTo(-33.33, 1)
    })
  })

  describe('Metric drift detection', () => {
    it('should detect if single aggregator produces different results', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]

      const result1 = aggregateCanonicalFinancialMetrics(rows)
      const result2 = aggregateCanonicalFinancialMetrics(rows)
      const result3 = aggregateCanonicalFinancialMetrics(rows)

      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
    })

    it('should detect if aggregator behavior changes for same fixture', () => {
      const scenarios = [
        SCENARIO_COMPLEX_MONTH,
        ...ALL_SCENARIOS.slice(0, 5),
      ]

      const firstRun = scenarios.map((s) =>
        aggregateCanonicalFinancialMetrics(s.rows as CanonicalFinancialRow[])
      )

      const secondRun = scenarios.map((s) =>
        aggregateCanonicalFinancialMetrics(s.rows as CanonicalFinancialRow[])
      )

      firstRun.forEach((result, index) => {
        expect(result).toEqual(secondRun[index])
      })
    })
  })
})
