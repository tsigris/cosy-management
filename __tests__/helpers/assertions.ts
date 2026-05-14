/**
 * Test assertion helpers for financial invariants
 */

import type {
  CanonicalFinancialSummary,
  CanonicalMonthPoint,
} from '@/lib/canonicalFinancialMetrics'

const EPSILON = 0.01 // Floating point tolerance

export const assertNumericEqual = (
  actual: number,
  expected: number,
  message: string
) => {
  expect(actual).toBeCloseTo(expected, 2)
  if (Math.abs(actual - expected) > EPSILON) {
    throw new Error(
      `${message}: expected ${expected}, got ${actual} (diff: ${actual - expected})`
    )
  }
}

export const assertSummaryEqual = (
  actual: CanonicalFinancialSummary,
  expected: Partial<CanonicalFinancialSummary>,
  context: string
) => {
  const keys = Object.keys(expected) as Array<keyof CanonicalFinancialSummary>

  for (const key of keys) {
    const expectedValue = expected[key]
    const actualValue = actual[key]

    if (typeof expectedValue === 'number') {
      assertNumericEqual(
        actualValue as number,
        expectedValue,
        `${context}.${String(key)}`
      )
    } else if (expectedValue !== null && expectedValue !== undefined) {
      expect(actualValue).toBe(expectedValue)
    }
  }
}

export const assertFinancialInvariant = (
  summary: CanonicalFinancialSummary,
  invariant: string
) => {
  switch (invariant) {
    case 'profit-calculation':
      assertNumericEqual(
        summary.profit,
        summary.totalRevenue - summary.totalExpenses,
        'Profit invariant'
      )
      break

    case 'total-revenue-cash-card':
      assertNumericEqual(
        summary.totalRevenue,
        summary.cashRevenue + summary.cardRevenue,
        'Revenue classification invariant'
      )
      break

    case 'credits-separate':
      expect(summary.credits).toBeGreaterThanOrEqual(0)
      break

    case 'transfers-excluded':
      assertNumericEqual(
        summary.profit,
        summary.totalRevenue - summary.totalExpenses,
        'Transfers excluded from profit invariant'
      )
      break

    case 'savings-excluded':
      assertNumericEqual(
        summary.profit,
        summary.totalRevenue - summary.totalExpenses,
        'Savings excluded from profit invariant'
      )
      break

    default:
      throw new Error(`Unknown invariant: ${invariant}`)
  }
}

export const compareMultipleSummaries = (
  summaries: Record<string, CanonicalFinancialSummary>,
  allowedDifference: Record<string, number> = {}
): { consistent: boolean; differences: Record<string, number> } => {
  const differences: Record<string, number> = {}
  const keys = Object.keys(summaries)

  if (keys.length === 0) {
    return { consistent: true, differences: {} }
  }

  const baseline = summaries[keys[0]]

  for (const key of keys.slice(1)) {
    const current = summaries[key]

    const totalRevenueDiff = Math.abs(
      current.totalRevenue - baseline.totalRevenue
    )
    const totalExpenseDiff = Math.abs(
      current.totalExpenses - baseline.totalExpenses
    )
    const profitDiff = Math.abs(current.profit - baseline.profit)

    if (
      totalRevenueDiff >
      (allowedDifference['totalRevenue'] ?? EPSILON)
    ) {
      differences[`${keys[0]}_vs_${key}_revenue`] = totalRevenueDiff
    }
    if (
      totalExpenseDiff >
      (allowedDifference['totalExpenses'] ?? EPSILON)
    ) {
      differences[`${keys[0]}_vs_${key}_expenses`] = totalExpenseDiff
    }
    if (profitDiff > (allowedDifference['profit'] ?? EPSILON)) {
      differences[`${keys[0]}_vs_${key}_profit`] = profitDiff
    }
  }

  return {
    consistent: Object.keys(differences).length === 0,
    differences,
  }
}

export const assertCrossPageConsistency = (
  dashboardSummary: CanonicalFinancialSummary,
  reportsSummary: CanonicalFinancialSummary,
  profitSummary: CanonicalFinancialSummary,
  analysisSummary: CanonicalFinancialSummary,
  comparisonSummary: CanonicalFinancialSummary
) => {
  const summaries = {
    dashboard: dashboardSummary,
    reports: reportsSummary,
    profit: profitSummary,
    analysis: analysisSummary,
    comparison: comparisonSummary,
  }

  const { consistent, differences } = compareMultipleSummaries(summaries)

  if (!consistent) {
    const diffStr = Object.entries(differences)
      .map(([key, val]) => `  ${key}: ${val}`)
      .join('\n')
    throw new Error(
      `Cross-page metric inconsistency detected:\n${diffStr}`
    )
  }
}

export const assertRolling30DaySemantics = (
  monthPoints: CanonicalMonthPoint[],
  totalDays: number,
  fromDateKey: string,
  toDateKey: string
) => {
  expect(totalDays).toBe(30)

  const fromDate = new Date(fromDateKey)
  const toDate = new Date(toDateKey)
  const diffDays = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  expect(diffDays).toBe(29) // 30 inclusive days = 29 day difference
}

export const assertNoProfitLeakage = (
  summary: CanonicalFinancialSummary
) => {
  // Profit should only include revenue and expenses
  const calculatedProfit = summary.totalRevenue - summary.totalExpenses
  assertNumericEqual(
    summary.profit,
    calculatedProfit,
    'Profit calculation includes unexpected components'
  )

  // Presence of transfers/savings is valid; only profit formula matters.
}
