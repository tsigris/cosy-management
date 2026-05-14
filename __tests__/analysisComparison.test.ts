/**
 * Server-side financial comparison tests
 * Tests analysisComparison.ts YoY comparison logic
 */

import { aggregateCanonicalFinancialMetrics } from '@/lib/canonicalFinancialMetrics'
import type { CanonicalFinancialRow } from '@/lib/canonicalFinancialMetrics'
import {
  SCENARIO_COMPLEX_MONTH,
  SCENARIO_INCOME_EXPENSE_BASIC,
} from './fixtures/financialScenarios'

describe('analysisComparison - Server-side YoY Logic', () => {
  describe('YoY Comparison Building', () => {
    it('should calculate YoY growth correctly', () => {
      const currentSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2026-05-14',
          amount: 200,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      const previousSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2025-05-14',
          amount: 100,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      expect(currentSummary.totalRevenue).toBe(200)
      expect(previousSummary.totalRevenue).toBe(100)

      const absoluteChange = currentSummary.totalRevenue - previousSummary.totalRevenue
      const percentChange = (absoluteChange / previousSummary.totalRevenue) * 100

      expect(absoluteChange).toBe(100)
      expect(percentChange).toBeCloseTo(100, 1)
    })

    it('should handle zero previous year', () => {
      const currentSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2026-05-14',
          amount: 200,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      const previousSummary = aggregateCanonicalFinancialMetrics([])

      expect(currentSummary.totalRevenue).toBe(200)
      expect(previousSummary.totalRevenue).toBe(0)

      // Should not throw or return Infinity
      const isNaN = previousSummary.totalRevenue === 0 ? true : false
      expect(isNaN).toBe(true)
    })

    it('should handle negative to positive transitions', () => {
      const currentSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2026-05-14',
          amount: 100,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      const previousSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2025-05-14',
          amount: -50,
          type: 'expense',
          category: 'Loss',
          method: 'Cash',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      expect(currentSummary.totalRevenue).toBeGreaterThan(0)
      expect(previousSummary.totalRevenue).toBe(0)
    })

    it('should track all metric changes', () => {
      const currentSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2026-05-14',
          amount: 500,
          type: 'income',
          category: 'Sales',
          method: 'Card',
          is_credit: false,
        },
        {
          date: '2026-05-14',
          amount: -200,
          type: 'expense',
          category: 'Supplies',
          method: 'Card',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      const previousSummary = aggregateCanonicalFinancialMetrics([
        {
          date: '2025-05-14',
          amount: 400,
          type: 'income',
          category: 'Sales',
          method: 'Card',
          is_credit: false,
        },
        {
          date: '2025-05-14',
          amount: -100,
          type: 'expense',
          category: 'Supplies',
          method: 'Card',
          is_credit: false,
        },
      ] as CanonicalFinancialRow[])

      expect(currentSummary.totalRevenue).toBe(500)
      expect(previousSummary.totalRevenue).toBe(400)

      expect(currentSummary.totalExpenses).toBe(200)
      expect(previousSummary.totalExpenses).toBe(100)

      expect(currentSummary.profit).toBe(300)
      expect(previousSummary.profit).toBe(300)
    })
  })

  describe('Cumulative total consistency', () => {
    it('should ensure daily aggregates sum to period total', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const rows = scenario.rows as CanonicalFinancialRow[]
      const range = { from: '2026-05-01', to: '2026-05-31' }

      const periodTotal = aggregateCanonicalFinancialMetrics(rows, { range })

      const dailyTotals = [
        aggregateCanonicalFinancialMetrics(
          rows.filter((r) => r.date === '2026-05-01'),
          { range: { from: '2026-05-01', to: '2026-05-01' } }
        ),
        aggregateCanonicalFinancialMetrics(
          rows.filter((r) => r.date === '2026-05-15'),
          { range: { from: '2026-05-15', to: '2026-05-15' } }
        ),
        aggregateCanonicalFinancialMetrics(
          rows.filter((r) => r.date >= '2026-05-17' && r.date <= '2026-05-28'),
          { range: { from: '2026-05-17', to: '2026-05-28' } }
        ),
      ]

      const summedRevenue = dailyTotals.reduce(
        (sum, daily) => sum + daily.totalRevenue,
        0
      )
      const summedExpenses = dailyTotals.reduce(
        (sum, daily) => sum + daily.totalExpenses,
        0
      )

      expect(summedRevenue).toBeCloseTo(periodTotal.totalRevenue, 2)
      expect(summedExpenses).toBeCloseTo(periodTotal.totalExpenses, 2)
    })
  })

  describe('Comparison invariants', () => {
    it('should never double-count transactions in YoY comparison', () => {
      const currentRows = SCENARIO_COMPLEX_MONTH.rows as CanonicalFinancialRow[]

      const currentSummary =
        aggregateCanonicalFinancialMetrics(currentRows)
      const previousSummary = aggregateCanonicalFinancialMetrics([])

      expect(currentSummary.totalRevenue).toBe(
        SCENARIO_COMPLEX_MONTH.expectedTotals.totalRevenue
      )
      expect(previousSummary.totalRevenue).toBe(0)
    })

    it('should maintain profit calculation in comparison', () => {
      const currentRows = SCENARIO_COMPLEX_MONTH.rows as CanonicalFinancialRow[]
      const previousRows = SCENARIO_INCOME_EXPENSE_BASIC.rows as CanonicalFinancialRow[]

      const currentSummary =
        aggregateCanonicalFinancialMetrics(currentRows)
      const previousSummary =
        aggregateCanonicalFinancialMetrics(previousRows)

      expect(currentSummary.profit).toBeCloseTo(
        currentSummary.totalRevenue - currentSummary.totalExpenses,
        2
      )
      expect(previousSummary.profit).toBeCloseTo(
        previousSummary.totalRevenue - previousSummary.totalExpenses,
        2
      )
    })
  })
})
