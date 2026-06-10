export type EmployeeWalletEntrySubtype =
  | 'salary'
  | 'salary_payment'
  | 'previous_period_payment'
  | 'partial_payment'
  | 'tip'
  | 'bonus'
  | 'gift'
  | 'advance'
  | 'deduction'
  | 'correction'
  | 'adjustment'

export type EmployeeWalletEntryKind = 'earning' | 'payment' | 'deduction' | 'adjustment'
export type EmployeeWalletDirection = 'increase_balance' | 'decrease_balance'

export type EmployeeWalletEntryConfig = {
  subtype: EmployeeWalletEntrySubtype
  label: string
  kind: EmployeeWalletEntryKind
  direction: EmployeeWalletDirection
  requiresPeriod: boolean
  defaultNotesLabel: string
}

export const EMPLOYEE_WALLET_ENTRY_CONFIG: Record<EmployeeWalletEntrySubtype, EmployeeWalletEntryConfig> = {
  salary: {
    subtype: 'salary',
    label: 'Salary Earnings',
    kind: 'earning',
    direction: 'increase_balance',
    requiresPeriod: true,
    defaultNotesLabel: 'Μισθός περιόδου',
  },
  salary_payment: {
    subtype: 'salary_payment',
    label: 'Salary Payment',
    kind: 'payment',
    direction: 'decrease_balance',
    requiresPeriod: true,
    defaultNotesLabel: 'Πληρωμή μισθού',
  },
  previous_period_payment: {
    subtype: 'previous_period_payment',
    label: 'Previous Month Payment',
    kind: 'payment',
    direction: 'decrease_balance',
    requiresPeriod: true,
    defaultNotesLabel: 'Πληρωμή προηγούμενης περιόδου',
  },
  partial_payment: {
    subtype: 'partial_payment',
    label: 'Partial Payment',
    kind: 'payment',
    direction: 'decrease_balance',
    requiresPeriod: true,
    defaultNotesLabel: 'Μερική πληρωμή',
  },
  tip: {
    subtype: 'tip',
    label: 'Tips',
    kind: 'earning',
    direction: 'increase_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Tips',
  },
  bonus: {
    subtype: 'bonus',
    label: 'Bonus',
    kind: 'earning',
    direction: 'increase_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Bonus',
  },
  gift: {
    subtype: 'gift',
    label: 'Gift',
    kind: 'earning',
    direction: 'increase_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Gift',
  },
  advance: {
    subtype: 'advance',
    label: 'Advance',
    kind: 'payment',
    direction: 'decrease_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Προκαταβολή',
  },
  deduction: {
    subtype: 'deduction',
    label: 'Deduction',
    kind: 'deduction',
    direction: 'decrease_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Κράτηση',
  },
  correction: {
    subtype: 'correction',
    label: 'Correction',
    kind: 'adjustment',
    direction: 'increase_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Διόρθωση',
  },
  adjustment: {
    subtype: 'adjustment',
    label: 'Adjustment',
    kind: 'adjustment',
    direction: 'increase_balance',
    requiresPeriod: false,
    defaultNotesLabel: 'Προσαρμογή',
  },
}

export function requiresWalletPeriod(subtype: EmployeeWalletEntrySubtype): boolean {
  return EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].requiresPeriod
}

export function getWalletEntryKind(subtype: EmployeeWalletEntrySubtype): EmployeeWalletEntryKind {
  return EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].kind
}

export function getWalletEntryDirection(
  subtype: EmployeeWalletEntrySubtype,
  correctionDirection?: EmployeeWalletDirection,
): EmployeeWalletDirection {
  if (subtype === 'correction' || subtype === 'adjustment') {
    return correctionDirection || 'increase_balance'
  }
  return EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].direction
}

export function computeWalletBalanceTotals(rows: Array<{
  kind: EmployeeWalletEntryKind
  subtype: string | null | undefined
  direction: EmployeeWalletDirection
  amount: number | string | null | undefined
}>): {
  currentBalance: number
  totalEarned: number
  totalPaid: number
  totalTips: number
  totalBonuses: number
  totalAdvances: number
  totalDeductions: number
} {
  let currentBalance = 0
  let totalEarned = 0
  let totalPaid = 0
  let totalTips = 0
  let totalBonuses = 0
  let totalAdvances = 0
  let totalDeductions = 0

  for (const row of rows) {
    const amount = Math.abs(Number(row.amount || 0))
    if (!Number.isFinite(amount) || amount <= 0) continue

    if (row.direction === 'increase_balance') currentBalance += amount
    else currentBalance -= amount

    if (row.kind === 'earning') totalEarned += amount
    if (row.kind === 'payment') totalPaid += amount
    if (row.subtype === 'tip') totalTips += amount
    if (row.subtype === 'bonus') totalBonuses += amount
    if (row.subtype === 'advance') totalAdvances += amount
    if (row.kind === 'deduction' || row.subtype === 'deduction') totalDeductions += amount
  }

  return {
    currentBalance,
    totalEarned,
    totalPaid,
    totalTips,
    totalBonuses,
    totalAdvances,
    totalDeductions,
  }
}
