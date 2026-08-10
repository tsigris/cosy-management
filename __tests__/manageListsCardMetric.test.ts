import { getSupplierBalanceComponents, type SupplierTxLike } from '@/lib/supplierCreditNote'
import { getManageListsCardAmountLabel, getManageListsCardMainAmount } from '@/lib/manageListsCardMetric'

function supplierHistory(rows: SupplierTxLike[]) {
  const canonical = getSupplierBalanceComponents(rows)
  return {
    balance: canonical.openBalance,
    totalCreditAmount: canonical.charges + canonical.creditNotes,
  }
}

describe('Manage Lists supplier card metric', () => {
  it('shows canonical supplier balance across sequential debt payments', () => {
    const baseRows: SupplierTxLike[] = [{ type: 'expense', is_credit: true, amount: -1000 }]
    const baseHistory = supplierHistory(baseRows)
    expect(baseHistory.balance).toBe(1000)
    expect(
      getManageListsCardMainAmount({
        activeTab: 'suppliers',
        isIncome: false,
        history: baseHistory,
      }),
    ).toBe(1000)

    const after300 = supplierHistory([...baseRows, { type: 'debt_payment', amount: -300 }])
    expect(after300.balance).toBe(700)
    expect(
      getManageListsCardMainAmount({
        activeTab: 'suppliers',
        isIncome: false,
        history: after300,
      }),
    ).toBe(700)

    const after500 = supplierHistory([...baseRows, { type: 'debt_payment', amount: -300 }, { type: 'debt_payment', amount: -200 }])
    expect(after500.balance).toBe(500)
    expect(
      getManageListsCardMainAmount({
        activeTab: 'suppliers',
        isIncome: false,
        history: after500,
      }),
    ).toBe(500)

    const afterFullSettlement = supplierHistory([
      ...baseRows,
      { type: 'debt_payment', amount: -300 },
      { type: 'debt_payment', amount: -200 },
      { type: 'debt_payment', amount: -500 },
    ])
    expect(afterFullSettlement.balance).toBe(0)
    expect(
      getManageListsCardMainAmount({
        activeTab: 'suppliers',
        isIncome: false,
        history: afterFullSettlement,
      }),
    ).toBe(0)
  })

  it('keeps canonical effects for credit notes, new credit expenses, and non-credit expenses', () => {
    const rows: SupplierTxLike[] = [
      { type: 'expense', is_credit: true, amount: -1000 },
      { type: 'debt_payment', amount: -300 },
      { type: 'supplier_credit_note', amount: 100 },
      { type: 'expense', is_credit: true, amount: -50 },
      { type: 'expense', is_credit: false, amount: -999 },
    ]

    const canonical = getSupplierBalanceComponents(rows)
    expect(canonical.charges).toBe(1050)
    expect(canonical.payments).toBe(300)
    expect(canonical.creditNotes).toBe(100)
    expect(canonical.openBalance).toBe(650)

    const mainAmount = getManageListsCardMainAmount({
      activeTab: 'suppliers',
      isIncome: false,
      history: {
        balance: canonical.openBalance,
        totalCreditAmount: canonical.charges + canonical.creditNotes,
      },
    })
    expect(mainAmount).toBe(650)
  })

  it('uses the same canonical result source as supplier balance screens', () => {
    const rows: SupplierTxLike[] = [
      { type: 'expense', is_credit: true, amount: -1000 },
      { type: 'debt_payment', amount: -250 },
      { type: 'supplier_credit_note', amount: 50 },
    ]
    const canonical = getSupplierBalanceComponents(rows)
    const manageListsAmount = getManageListsCardMainAmount({
      activeTab: 'suppliers',
      isIncome: false,
      history: {
        balance: canonical.openBalance,
        totalCreditAmount: canonical.charges + canonical.creditNotes,
      },
    })

    expect(manageListsAmount).toBe(canonical.openBalance)
  })

  it('keeps non-supplier cards on existing turnover/charge metric', () => {
    const history = { balance: 700, totalCreditAmount: 1000 }

    expect(
      getManageListsCardMainAmount({
        activeTab: 'maintenance',
        isIncome: false,
        history,
      }),
    ).toBe(1000)

    expect(
      getManageListsCardMainAmount({
        activeTab: 'revenue',
        isIncome: true,
        history,
      }),
    ).toBe(700)
  })

  it('labels supplier headline as current balance', () => {
    expect(getManageListsCardAmountLabel({ activeTab: 'suppliers', isIncome: false })).toBe('Υπόλοιπο')
    expect(getManageListsCardAmountLabel({ activeTab: 'maintenance', isIncome: false })).toBe('Τζίρος')
  })
})
