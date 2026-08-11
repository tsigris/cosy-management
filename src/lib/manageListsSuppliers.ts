type SupplierLikeTx = {
  id?: string | number | null
  supplier_id?: string | number | null
  type?: string | null
  amount?: number | string | null
  date?: string | null
  created_at?: string | null
  notes?: string | null
  method?: string | null
  linked_invoice_tx_id?: string | null
}

type TotalsMap = Record<string, number>

const SUPPLIER_TURNOVER_TYPE = 'expense'
const SUPPLIER_HISTORY_CHARGE_TYPES = new Set(['expense', 'supplier_credit_note'])
const SUPPLIER_HISTORY_PAYMENT_TYPES = new Set(['debt_payment'])

function normalizeType(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function toAbsAmount(value: unknown) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? Math.abs(n) : 0
}

function getTxDateValue(tx: SupplierLikeTx) {
  const raw = tx?.date || tx?.created_at
  const d = raw ? new Date(String(raw)) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function isTxInYear(tx: SupplierLikeTx, year: number) {
  const d = getTxDateValue(tx)
  return !!d && d.getFullYear() === year
}

function sortByDateDesc(a: SupplierLikeTx, b: SupplierLikeTx) {
  return (getTxDateValue(b)?.getTime() || 0) - (getTxDateValue(a)?.getTime() || 0)
}

export function buildSupplierTurnoverTotalsForYear(transactions: SupplierLikeTx[], year: number): TotalsMap {
  const totals: TotalsMap = {}

  for (const tx of transactions || []) {
    const supplierId = String(tx?.supplier_id || '').trim()
    if (!supplierId) continue
    if (!isTxInYear(tx, year)) continue
    if (normalizeType(tx?.type) !== SUPPLIER_TURNOVER_TYPE) continue

    totals[supplierId] = (totals[supplierId] || 0) + toAbsAmount(tx?.amount)
  }

  return totals
}

export function getSupplierYearMovementHistory(transactions: SupplierLikeTx[], supplierId: string, year: number) {
  const sid = String(supplierId || '').trim()

  const entityRows = (transactions || [])
    .filter((tx) => String(tx?.supplier_id || '').trim() === sid)
    .filter((tx) => isTxInYear(tx, year))

  const chargeMovements = entityRows
    .filter((tx) => SUPPLIER_HISTORY_CHARGE_TYPES.has(normalizeType(tx?.type)))
    .sort(sortByDateDesc)

  const paymentMovements = entityRows
    .filter((tx) => SUPPLIER_HISTORY_PAYMENT_TYPES.has(normalizeType(tx?.type)))
    .sort(sortByDateDesc)

  const annualTurnover = entityRows
    .filter((tx) => normalizeType(tx?.type) === SUPPLIER_TURNOVER_TYPE)
    .reduce((acc, tx) => acc + toAbsAmount(tx?.amount), 0)

  return {
    chargeMovements,
    paymentMovements,
    annualTurnover,
  }
}

export function hasDeterministicSupplierInvoicePaymentLink(transactions: SupplierLikeTx[]) {
  // In current schema, debt_payment rows have no explicit invoice foreign key.
  // linked_invoice_tx_id is used for supplier credit notes.
  for (const tx of transactions || []) {
    if (normalizeType(tx?.type) !== 'debt_payment') continue
    const linkedInvoice = String(tx?.linked_invoice_tx_id || '').trim()
    if (linkedInvoice) return true
  }
  return false
}
