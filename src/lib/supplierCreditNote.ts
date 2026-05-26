export type SupplierTxLike = {
  type?: string | null
  amount?: number | string | null
  is_credit?: boolean | null
  supplier_id?: string | null
  voided_at?: string | null
}

export type SupplierCreditNoteDraftInput = {
  amount: number
  supplierId: string | null | undefined
  reason: string | null | undefined
}

function normalizeType(type: unknown) {
  return String(type || '').trim().toLowerCase()
}

function toAbsAmount(value: unknown) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? Math.abs(n) : 0
}

export function isActiveRow(row: SupplierTxLike | null | undefined) {
  return !!row && !row.voided_at
}

export function isSupplierChargeTx(row: SupplierTxLike | null | undefined) {
  if (!isActiveRow(row)) return false
  return normalizeType(row?.type) === 'expense' && row?.is_credit === true
}

export function isSupplierPaymentTx(row: SupplierTxLike | null | undefined) {
  if (!isActiveRow(row)) return false
  return normalizeType(row?.type) === 'debt_payment'
}

export function isSupplierCreditNoteTx(row: SupplierTxLike | null | undefined) {
  if (!isActiveRow(row)) return false
  return normalizeType(row?.type) === 'supplier_credit_note'
}

export function getSupplierBalanceComponents(rows: SupplierTxLike[]) {
  let charges = 0
  let payments = 0
  let creditNotes = 0

  for (const row of rows || []) {
    if (isSupplierChargeTx(row)) {
      charges += toAbsAmount(row?.amount)
      continue
    }
    if (isSupplierPaymentTx(row)) {
      payments += toAbsAmount(row?.amount)
      continue
    }
    if (isSupplierCreditNoteTx(row)) {
      creditNotes += toAbsAmount(row?.amount)
    }
  }

  return {
    charges,
    payments,
    creditNotes,
    openBalance: charges - payments - creditNotes,
  }
}

export function normalizeSupplierCreditNoteNumber(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  return normalized.length > 0 ? normalized : null
}

export function validateSupplierCreditNoteDraft(input: SupplierCreditNoteDraftInput) {
  const amount = Number(input.amount || 0)
  const supplierId = String(input.supplierId || '').trim()
  const reason = String(input.reason || '').trim()

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      message: 'Το ποσό πιστωτικού πρέπει να είναι θετικό.',
    } as const
  }

  if (!supplierId) {
    return {
      ok: false,
      code: 'MISSING_SUPPLIER',
      message: 'Απαιτείται προμηθευτής.',
    } as const
  }

  if (!reason) {
    return {
      ok: false,
      code: 'MISSING_REASON',
      message: 'Απαιτείται αιτιολογία.',
    } as const
  }

  return {
    ok: true,
    code: 'OK',
    message: 'VALID',
  } as const
}
