import {
  computeWalletBalanceTotals,
  getWalletEntryDirection,
  getWalletEntryKind,
  requiresWalletPeriod,
} from '@/lib/employeeWallet'

describe('employee wallet config', () => {
  it('maps salary payment to payment kind', () => {
    expect(getWalletEntryKind('salary_payment')).toBe('payment')
  })

  it('requires period for salary-related entries', () => {
    expect(requiresWalletPeriod('salary')).toBe(true)
    expect(requiresWalletPeriod('salary_payment')).toBe(true)
    expect(requiresWalletPeriod('partial_payment')).toBe(true)
    expect(requiresWalletPeriod('tip')).toBe(false)
  })

  it('uses explicit direction for corrections', () => {
    expect(getWalletEntryDirection('correction', 'increase_balance')).toBe('increase_balance')
    expect(getWalletEntryDirection('correction', 'decrease_balance')).toBe('decrease_balance')
  })
})

describe('employee wallet totals', () => {
  it('computes totals and balance from ledger directions', () => {
    const totals = computeWalletBalanceTotals([
      { kind: 'earning', subtype: 'salary', direction: 'increase_balance', amount: 1000 },
      { kind: 'earning', subtype: 'tip', direction: 'increase_balance', amount: 50 },
      { kind: 'earning', subtype: 'bonus', direction: 'increase_balance', amount: 100 },
      { kind: 'payment', subtype: 'salary_payment', direction: 'decrease_balance', amount: 700 },
      { kind: 'payment', subtype: 'advance', direction: 'decrease_balance', amount: 100 },
      { kind: 'deduction', subtype: 'deduction', direction: 'decrease_balance', amount: 25 },
    ])

    expect(totals.totalEarned).toBe(1150)
    expect(totals.totalPaid).toBe(800)
    expect(totals.totalTips).toBe(50)
    expect(totals.totalBonuses).toBe(100)
    expect(totals.totalAdvances).toBe(100)
    expect(totals.totalDeductions).toBe(25)
    expect(totals.currentBalance).toBe(325)
  })

  it('ignores invalid or zero amounts', () => {
    const totals = computeWalletBalanceTotals([
      { kind: 'earning', subtype: 'salary', direction: 'increase_balance', amount: 0 },
      { kind: 'payment', subtype: 'advance', direction: 'decrease_balance', amount: null },
    ])

    expect(totals.currentBalance).toBe(0)
    expect(totals.totalEarned).toBe(0)
    expect(totals.totalPaid).toBe(0)
  })
})
