import { countInclusiveDays, enumerateDateKeys, normalizeRange, type FinancialDateRange } from '@/lib/financialPeriods'

export type CanonicalFinancialRow = {
  id?: string | number | null
  date: string
  amount?: number | string | null
  type?: string | null
  category?: string | null
  method?: string | null
  payment_method?: string | null
  notes?: string | null
  description?: string | null
  is_credit?: boolean | null
}

export type CanonicalFinancialSummary = {
  totalRevenue: number
  totalExpenses: number
  profit: number
  payrollPct: number
  cashRevenue: number
  cardRevenue: number
  averageTicket: number
  transactionCount: number
  credits: number
  zTotals: number
  bankTotals: number
  cashTotals: number
  transferIn: number
  transferOut: number
  transferNet: number
  savingsDeposits: number
  savingsWithdrawals: number
  totalBalance: number
  revenueByDate: Record<string, number>
  zByDate: Record<string, number>
}

export type CanonicalMonthPoint = {
  ym: string
  revenue: number
  expenses: number
  profit: number
}

export const CANONICAL_METRIC_DEFINITIONS = {
  totalRevenue:
    'Sum of non-credit transactions where type = income, excluding transfer movements and excluding savings/debt-collection movement types.',
  totalExpenses:
    'Sum of absolute amounts for non-credit transactions where type is expense, debt_payment, or salary_advance, excluding transfer movements.',
  profit:
    'totalRevenue - totalExpenses.',
  payrollPct:
    'Value returned by get_staff_payroll_pressure_period_summary for the same period.',
  cashRevenue:
    'Subset of totalRevenue whose payment method is classified as cash-like.',
  cardRevenue:
    'Subset of totalRevenue whose payment method is classified as card/bank-like.',
  averageTicket:
    'totalRevenue / transactionCount, where transactionCount counts only totalRevenue transactions.',
  transactionCount:
    'Count of non-credit revenue transactions included in totalRevenue.',
  credits:
    'Sum of absolute amounts for credit expense transactions (expense, debt_payment, salary_advance with is_credit = true), excluding transfer movements.',
  zTotals:
    'Sum of non-credit income transactions categorized as Εσοδα Ζ.',
  bankTotals:
    'Net balance effect of non-credit card/bank-classified transactions, excluding transfers; income positive, expenses and savings_deposit negative, savings_withdrawal positive.',
  transferMovements:
    'Transactions whose normalized category or notes indicate internal transfer / μεταφορά κεφαλαίου.',
  savingsHandling:
    'savings_deposit and savings_withdrawal are excluded from revenue, expenses, profit, transactionCount, and averageTicket, but included in cash/bank balance tracking.',
  debtHandling:
    'income_collection and debt_received are excluded from totalRevenue/profit and treated as non-revenue cash movements for consistency with analysis and payroll turnover.',
} as const

const REVENUE_TYPES = new Set(['income'])
const EXPENSE_TYPES = new Set(['expense', 'debt_payment', 'salary_advance'])
const SAVINGS_DEPOSIT_TYPES = new Set(['savings_deposit'])
const SAVINGS_WITHDRAWAL_TYPES = new Set(['savings_withdrawal'])
const CASH_METHOD_MARKERS = ['cash', 'μετρητ', 'μετρητά', 'μετρητα', 'χωρις αποδειξη', 'χωρίς απόδειξη', 'χωρις σημανση', 'χωρίς σήμανση', '(z)']
const CARD_METHOD_MARKERS = ['card', 'κάρτα', 'καρτα', 'τραπεζ', 'bank', 'pos', 'iban']
const TRANSFER_MARKERS = ['μεταφορ', 'transfer']

export function normalizeFinancialText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getCanonicalPaymentMethod(row: Pick<CanonicalFinancialRow, 'method' | 'payment_method'>): string {
  return String(row.payment_method ?? row.method ?? '').trim()
}

export function isTransferMovement(row: Pick<CanonicalFinancialRow, 'category' | 'notes' | 'description' | 'type'>): boolean {
  const haystacks = [row.category, row.notes, row.description, row.type].map(normalizeFinancialText)
  return haystacks.some((value) => TRANSFER_MARKERS.some((marker) => value.includes(marker)))
}

export function isCashLikeMethod(method: string | null | undefined): boolean {
  const normalized = normalizeFinancialText(method)
  return CASH_METHOD_MARKERS.some((marker) => normalized.includes(marker))
}

export function isCardLikeMethod(method: string | null | undefined): boolean {
  const normalized = normalizeFinancialText(method)
  return CARD_METHOD_MARKERS.some((marker) => normalized.includes(marker))
}

export function isRevenueTransaction(row: CanonicalFinancialRow): boolean {
  return REVENUE_TYPES.has(String(row.type || '')) && row.is_credit !== true && !isTransferMovement(row)
}

export function isExpenseTransaction(row: CanonicalFinancialRow): boolean {
  return EXPENSE_TYPES.has(String(row.type || '')) && row.is_credit !== true && !isTransferMovement(row)
}

export function isCreditExpenseTransaction(row: CanonicalFinancialRow): boolean {
  return EXPENSE_TYPES.has(String(row.type || '')) && row.is_credit === true && !isTransferMovement(row)
}

export function isSavingsDepositTransaction(row: CanonicalFinancialRow): boolean {
  return SAVINGS_DEPOSIT_TYPES.has(String(row.type || '')) && row.is_credit !== true
}

export function isSavingsWithdrawalTransaction(row: CanonicalFinancialRow): boolean {
  return SAVINGS_WITHDRAWAL_TYPES.has(String(row.type || '')) && row.is_credit !== true
}

export function isZTransaction(row: CanonicalFinancialRow): boolean {
  return isRevenueTransaction(row) && normalizeFinancialText(row.category) === 'εσοδα ζ'
}

export function toAmount(value: unknown): number {
  const next = Number(value || 0)
  return Number.isFinite(next) ? next : 0
}

export function filterRowsByRange<T extends CanonicalFinancialRow>(rows: T[], range: FinancialDateRange): T[] {
  const normalized = normalizeRange(range)
  return rows.filter((row) => row.date >= normalized.from && row.date <= normalized.to)
}

export function aggregateCanonicalFinancialMetrics(
  rows: CanonicalFinancialRow[],
  options?: {
    range?: FinancialDateRange
    payrollPct?: number
  },
): CanonicalFinancialSummary {
  const scopedRows = options?.range ? filterRowsByRange(rows, options.range) : rows

  let totalRevenue = 0
  let totalExpenses = 0
  let cashRevenue = 0
  let cardRevenue = 0
  let transactionCount = 0
  let credits = 0
  let zTotals = 0
  let bankTotals = 0
  let cashTotals = 0
  let transferIn = 0
  let transferOut = 0
  let savingsDeposits = 0
  let savingsWithdrawals = 0
  const revenueByDate: Record<string, number> = {}
  const zByDate: Record<string, number> = {}

  for (const row of scopedRows) {
    const amount = toAmount(row.amount)
    const absAmount = Math.abs(amount)
    const paymentMethod = getCanonicalPaymentMethod(row)
    const transfer = isTransferMovement(row)

    if (transfer) {
      if (amount >= 0) transferIn += absAmount
      else transferOut += absAmount
      continue
    }

    if (isCreditExpenseTransaction(row)) {
      credits += absAmount
      continue
    }

    if (isRevenueTransaction(row)) {
      totalRevenue += amount
      transactionCount += 1
      revenueByDate[row.date] = toAmount(revenueByDate[row.date]) + amount
      if (isCashLikeMethod(paymentMethod)) cashRevenue += amount
      if (isCardLikeMethod(paymentMethod)) cardRevenue += amount
      if (isCashLikeMethod(paymentMethod)) cashTotals += amount
      else if (isCardLikeMethod(paymentMethod)) bankTotals += amount
      if (isZTransaction(row)) {
        zTotals += amount
        zByDate[row.date] = toAmount(zByDate[row.date]) + amount
      }
      continue
    }

    if (isExpenseTransaction(row)) {
      totalExpenses += absAmount
      if (isCashLikeMethod(paymentMethod)) cashTotals -= absAmount
      else if (isCardLikeMethod(paymentMethod)) bankTotals -= absAmount
      continue
    }

    if (isSavingsDepositTransaction(row)) {
      savingsDeposits += absAmount
      if (isCashLikeMethod(paymentMethod)) cashTotals -= absAmount
      else if (isCardLikeMethod(paymentMethod)) bankTotals -= absAmount
      continue
    }

    if (isSavingsWithdrawalTransaction(row)) {
      savingsWithdrawals += absAmount
      if (isCashLikeMethod(paymentMethod)) cashTotals += absAmount
      else if (isCardLikeMethod(paymentMethod)) bankTotals += absAmount
      continue
    }

    // Debt collections / incoming debt receipts are deliberately excluded from revenue/profit,
    // but they still move balance when method classification is available.
    const type = String(row.type || '')
    if ((type === 'income_collection' || type === 'debt_received') && row.is_credit !== true) {
      if (isCashLikeMethod(paymentMethod)) cashTotals += absAmount
      else if (isCardLikeMethod(paymentMethod)) bankTotals += absAmount
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    profit: totalRevenue - totalExpenses,
    payrollPct: Number(options?.payrollPct || 0),
    cashRevenue,
    cardRevenue,
    averageTicket: transactionCount > 0 ? totalRevenue / transactionCount : 0,
    transactionCount,
    credits,
    zTotals,
    bankTotals,
    cashTotals,
    transferIn,
    transferOut,
    transferNet: transferIn - transferOut,
    savingsDeposits,
    savingsWithdrawals,
    totalBalance: cashTotals + bankTotals,
    revenueByDate,
    zByDate,
  }
}

export function buildCanonicalMonthlySeries(
  rows: CanonicalFinancialRow[],
  range: FinancialDateRange,
): CanonicalMonthPoint[] {
  const normalized = normalizeRange(range)
  const monthMap = new Map<string, CanonicalMonthPoint>()

  for (const dateKey of enumerateDateKeys(normalized)) {
    const ym = dateKey.slice(0, 7)
    if (!monthMap.has(ym)) {
      monthMap.set(ym, {
        ym,
        revenue: 0,
        expenses: 0,
        profit: 0,
      })
    }
  }

  for (const row of filterRowsByRange(rows, normalized)) {
    const ym = row.date.slice(0, 7)
    const target = monthMap.get(ym)
    if (!target) continue

    if (isRevenueTransaction(row)) {
      target.revenue += toAmount(row.amount)
      target.profit += toAmount(row.amount)
      continue
    }

    if (isExpenseTransaction(row)) {
      const absAmount = Math.abs(toAmount(row.amount))
      target.expenses += absAmount
      target.profit -= absAmount
    }
  }

  return Array.from(monthMap.values()).sort((left, right) => left.ym.localeCompare(right.ym))
}

export function getCanonicalRangeDays(range: FinancialDateRange): number {
  return countInclusiveDays(range)
}
