export type ManageListsTabKey = 'suppliers' | 'utility' | 'staff' | 'maintenance' | 'other' | 'revenue'

type CardHistoryLike = {
  balance: number
  totalCreditAmount: number
}

type CardMetricInput = {
  activeTab: ManageListsTabKey
  isIncome: boolean
  history: CardHistoryLike
}

function toSafeNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function getManageListsCardMainAmount(input: CardMetricInput) {
  // Suppliers headline must always reflect remaining payable balance.
  if (input.activeTab === 'suppliers') {
    return toSafeNumber(input.history.balance)
  }

  // Preserve existing behavior for other tabs.
  if (input.isIncome) {
    return toSafeNumber(input.history.balance)
  }

  return toSafeNumber(input.history.totalCreditAmount)
}

export function getManageListsCardAmountLabel(input: Pick<CardMetricInput, 'activeTab' | 'isIncome'>) {
  if (input.activeTab === 'suppliers') return 'Υπόλοιπο'
  if (input.isIncome) return 'Υπόλοιπο'
  return 'Τζίρος'
}
