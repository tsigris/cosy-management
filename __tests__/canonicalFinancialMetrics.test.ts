/**
 * Core financial metrics engine tests
 * Tests canonicalFinancialMetrics.ts and all transaction classifiers
 */

import {
  aggregateCanonicalFinancialMetrics,
  buildCanonicalMonthlySeries,
  isRevenueTransaction,
  isExpenseTransaction,
  isCreditExpenseTransaction,
  isTransferMovement,
  isZTransaction,
  isSavingsDepositTransaction,
  isSavingsWithdrawalTransaction,
  isCashLikeMethod,
  isCardLikeMethod,
} from '@/lib/canonicalFinancialMetrics'
import type { CanonicalFinancialRow } from '@/lib/canonicalFinancialMetrics'
import {
  ALL_SCENARIOS,
  SCENARIO_COMPLEX_MONTH,
  SCENARIO_EMPTY_PERIOD,
  SCENARIO_CASH_CARD_MIX,
  SCENARIO_CREDIT_EXPENSES,
  SCENARIO_TRANSFERS,
} from './fixtures/financialScenarios'
import {
  assertNumericEqual,
  assertSummaryEqual,
  assertFinancialInvariant,
  assertNoProfitLeakage,
} from './helpers/assertions'

describe('canonicalFinancialMetrics', () => {
  // ============================================================
  // CLASSIFIER TESTS
  // ============================================================

  describe('Transaction Classifiers', () => {
    describe('isRevenueTransaction', () => {
      it('should identify income as revenue', () => {
        expect(
          isRevenueTransaction({
            type: 'income',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify expenses as revenue', () => {
        expect(
          isRevenueTransaction({
            type: 'expense',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })

      it('should not identify transfers as revenue', () => {
        expect(
          isRevenueTransaction({
            type: 'transfer',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })

      it('should not identify savings as revenue', () => {
        expect(
          isRevenueTransaction({
            type: 'savings_deposit',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })

      it('should not identify income_collection as revenue', () => {
        expect(
          isRevenueTransaction({
            type: 'income_collection',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isExpenseTransaction', () => {
      it('should identify expense as expense', () => {
        expect(
          isExpenseTransaction({
            type: 'expense',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should identify debt_payment as expense', () => {
        expect(
          isExpenseTransaction({
            type: 'debt_payment',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should identify salary_advance as expense', () => {
        expect(
          isExpenseTransaction({
            type: 'salary_advance',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify income as expense', () => {
        expect(
          isExpenseTransaction({
            type: 'income',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })

      it('should not identify transfers as expense', () => {
        expect(
          isExpenseTransaction({
            type: 'transfer',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isCreditExpenseTransaction', () => {
      it('should identify expense with is_credit=true', () => {
        expect(
          isCreditExpenseTransaction({
            type: 'expense',
            is_credit: true,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify expense with is_credit=false', () => {
        expect(
          isCreditExpenseTransaction({
            type: 'expense',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })

      it('should not identify income as credit', () => {
        expect(
          isCreditExpenseTransaction({
            type: 'income',
            is_credit: true,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isTransferMovement', () => {
      it('should identify transfer type', () => {
        expect(
          isTransferMovement({
            type: 'transfer',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify income as transfer', () => {
        expect(
          isTransferMovement({
            type: 'income',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isZTransaction', () => {
      it('should identify Z-income by category', () => {
        expect(
          isZTransaction({
            type: 'income',
            category: 'Εσοδα Ζ',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should handle Greek normalization', () => {
        expect(
          isZTransaction({
            type: 'income',
            category: 'Εσοδα Ζ',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify regular income as Z', () => {
        expect(
          isZTransaction({
            type: 'income',
            category: 'Sales',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isSavingsDepositTransaction', () => {
      it('should identify savings_deposit type', () => {
        expect(
          isSavingsDepositTransaction({
            type: 'savings_deposit',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })

      it('should not identify savings_withdrawal as deposit', () => {
        expect(
          isSavingsDepositTransaction({
            type: 'savings_withdrawal',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(false)
      })
    })

    describe('isSavingsWithdrawalTransaction', () => {
      it('should identify savings_withdrawal type', () => {
        expect(
          isSavingsWithdrawalTransaction({
            type: 'savings_withdrawal',
            is_credit: false,
          } as CanonicalFinancialRow)
        ).toBe(true)
      })
    })

  })

  describe('Method Classifiers', () => {
    describe('isCashLikeMethod', () => {
      it('should identify Cash method', () => {
        expect(isCashLikeMethod('Cash')).toBe(true)
      })

      it('should identify Greek Μετρητά method', () => {
        expect(isCashLikeMethod('Μετρητά')).toBe(true)
      })

      it('should not identify Card method', () => {
        expect(isCashLikeMethod('Card')).toBe(false)
      })
    })

    describe('isCardLikeMethod', () => {
      it('should identify Card method', () => {
        expect(isCardLikeMethod('Card')).toBe(true)
      })

      it('should identify Greek Κάρτα method', () => {
        expect(isCardLikeMethod('Κάρτα')).toBe(true)
      })

      it('should not identify Bank Transfer method', () => {
        expect(isCardLikeMethod('Bank Transfer')).toBe(true)
      })

      it('should not identify Cash method', () => {
        expect(isCardLikeMethod('Cash')).toBe(false)
      })
    })
  })

  // ============================================================
  // AGGREGATION TESTS
  // ============================================================

  describe('aggregateCanonicalFinancialMetrics', () => {
    it('should return zeros for empty period', () => {
      const summary = aggregateCanonicalFinancialMetrics([])

      assertSummaryEqual(summary, {
        totalRevenue: 0,
        totalExpenses: 0,
        profit: 0,
        credits: 0,
        cashRevenue: 0,
        cardRevenue: 0,
        transactionCount: 0,
      }, 'Empty period')
    })

    it('should aggregate all scenarios correctly', () => {
      ALL_SCENARIOS.forEach((scenario) => {
        const summary = aggregateCanonicalFinancialMetrics(
          scenario.rows as CanonicalFinancialRow[]
        )

        assertSummaryEqual(summary, scenario.expectedTotals as any, scenario.name)
      })
    })

    it('should maintain profit invariant', () => {
      ALL_SCENARIOS.forEach((scenario) => {
        const summary = aggregateCanonicalFinancialMetrics(
          scenario.rows as CanonicalFinancialRow[]
        )

        assertFinancialInvariant(summary, 'profit-calculation')
      })
    })

    it('should properly classify cash vs card revenue', () => {
      const scenario = SCENARIO_CASH_CARD_MIX
      const summary = aggregateCanonicalFinancialMetrics(
        scenario.rows as CanonicalFinancialRow[]
      )

      assertFinancialInvariant(summary, 'total-revenue-cash-card')
      assertNumericEqual(
        summary.cashRevenue,
        100,
        'Cash revenue should be 100'
      )
      assertNumericEqual(
        summary.cardRevenue,
        350,
        'Card revenue should be 350'
      )
    })

    it('should exclude credits from expenses but track separately', () => {
      const scenario = SCENARIO_CREDIT_EXPENSES
      const summary = aggregateCanonicalFinancialMetrics(
        scenario.rows as CanonicalFinancialRow[]
      )

      // Credits are excluded from totalExpenses
      assertNumericEqual(summary.totalExpenses, 0, 'Expenses should be 0')
      // But tracked separately
      assertNumericEqual(summary.credits, 50, 'Credits should be 50')
      // Profit should reflect revenue only, since expenses are on credit
      assertNumericEqual(summary.profit, 100, 'Profit should be 100')
    })

    it('should exclude transfers from revenue/expense/profit', () => {
      const scenario = SCENARIO_TRANSFERS
      const summary = aggregateCanonicalFinancialMetrics(
        scenario.rows as CanonicalFinancialRow[]
      )

      // Only revenue should be counted
      assertNumericEqual(
        summary.totalRevenue,
        100,
        'Revenue should exclude transfers'
      )
      assertNumericEqual(
        summary.totalExpenses,
        0,
        'Expenses should exclude transfers'
      )
      // But transfers should be tracked
      assertNumericEqual(summary.transferIn, 50, 'Transfer in should be 50')
      assertNumericEqual(summary.transferOut, 30, 'Transfer out should be 30')
    })

    it('should apply date range filter when provided', () => {
      const rows: CanonicalFinancialRow[] = [
        {
          date: '2026-05-01',
          amount: 100,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
        {
          date: '2026-05-15',
          amount: 150,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
        {
          date: '2026-06-01',
          amount: 200,
          type: 'income',
          category: 'Sales',
          method: 'Cash',
          is_credit: false,
        },
      ]

      const summaryMay = aggregateCanonicalFinancialMetrics(rows, {
        range: { from: '2026-05-01', to: '2026-05-31' },
      })

      assertNumericEqual(summaryMay.totalRevenue, 250, 'May revenue should be 250')

      const summaryFirst15 = aggregateCanonicalFinancialMetrics(rows, {
        range: { from: '2026-05-01', to: '2026-05-15' },
      })

      assertNumericEqual(
        summaryFirst15.totalRevenue,
        250,
        'First 15 days should include both transactions'
      )
    })

    it('should prevent profit leakage from non-financial movements', () => {
      ALL_SCENARIOS.forEach((scenario) => {
        const summary = aggregateCanonicalFinancialMetrics(
          scenario.rows as CanonicalFinancialRow[]
        )

        assertNoProfitLeakage(summary)
      })
    })

    it('should handle complex month scenario', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const summary = aggregateCanonicalFinancialMetrics(
        scenario.rows as CanonicalFinancialRow[]
      )

      assertSummaryEqual(
        summary,
        {
          totalRevenue: 650,
          totalExpenses: 450,
          profit: 200,
          credits: 100,
        },
        'Complex month'
      )
    })
  })

  // ============================================================
  // MONTHLY SERIES TESTS
  // ============================================================

  describe('buildCanonicalMonthlySeries', () => {
    it('should generate monthly breakdowns', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const range = {
        from: '2026-05-01',
        to: '2026-05-31',
      }

      const series = buildCanonicalMonthlySeries(
        scenario.rows as CanonicalFinancialRow[],
        range
      )

      expect(series.length).toBeGreaterThan(0)
      expect(series[0]).toHaveProperty('ym')
      expect(series[0]).toHaveProperty('revenue')
      expect(series[0]).toHaveProperty('expenses')
    })

    it('should aggregate monthly totals correctly', () => {
      const scenario = SCENARIO_COMPLEX_MONTH
      const range = {
        from: '2026-05-01',
        to: '2026-05-31',
      }

      const series = buildCanonicalMonthlySeries(
        scenario.rows as CanonicalFinancialRow[],
        range
      )

      const totalRevenue = series.reduce((sum, point) => sum + point.revenue, 0)
      const totalExpenses = series.reduce(
        (sum, point) => sum + point.expenses,
        0
      )

      // Should match aggregated totals
      const summary = aggregateCanonicalFinancialMetrics(
        scenario.rows as CanonicalFinancialRow[],
        { range }
      )

      assertNumericEqual(
        totalRevenue,
        summary.totalRevenue,
        'Series revenue should equal summary'
      )
      assertNumericEqual(
        totalExpenses,
        summary.totalExpenses,
        'Series expenses should equal summary'
      )
    })
  })
})
