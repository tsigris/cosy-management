import {
  getSupplierBalanceComponents,
  isSupplierCreditNoteTx,
  normalizeSupplierCreditNoteNumber,
  validateSupplierCreditNoteDraft,
  type SupplierTxLike,
} from '@/lib/supplierCreditNote'

describe('supplierCreditNote helper', () => {
  it('computes supplier open balance as charges - payments - credit notes', () => {
    const rows: SupplierTxLike[] = [
      { type: 'expense', is_credit: true, amount: -100 },
      { type: 'expense', is_credit: true, amount: -40 },
      { type: 'debt_payment', amount: -50 },
      { type: 'supplier_credit_note', amount: 30 },
    ]

    const result = getSupplierBalanceComponents(rows)

    expect(result.charges).toBe(140)
    expect(result.payments).toBe(50)
    expect(result.creditNotes).toBe(30)
    expect(result.openBalance).toBe(60)
  })

  it('excludes voided rows from all supplier balance components', () => {
    const rows: SupplierTxLike[] = [
      { type: 'expense', is_credit: true, amount: -100 },
      { type: 'debt_payment', amount: -40 },
      { type: 'supplier_credit_note', amount: 20 },
      { type: 'supplier_credit_note', amount: 20, voided_at: '2026-05-26T12:00:00Z' },
      { type: 'expense', is_credit: true, amount: -30, voided_at: '2026-05-26T12:00:00Z' },
    ]

    const result = getSupplierBalanceComponents(rows)

    expect(result.charges).toBe(100)
    expect(result.payments).toBe(40)
    expect(result.creditNotes).toBe(20)
    expect(result.openBalance).toBe(40)
  })

  it('recognizes supplier_credit_note rows as explicit credit-note movements', () => {
    expect(isSupplierCreditNoteTx({ type: 'supplier_credit_note', amount: 10 })).toBe(true)
    expect(isSupplierCreditNoteTx({ type: 'supplier_credit_note', amount: 10, voided_at: 'x' })).toBe(false)
    expect(isSupplierCreditNoteTx({ type: 'expense', is_credit: true, amount: -10 })).toBe(false)
  })

  it('normalizes credit note number for duplicate-protection usage', () => {
    expect(normalizeSupplierCreditNoteNumber('  CN-001  ')).toBe('CN-001')
    expect(normalizeSupplierCreditNoteNumber('   ')).toBeNull()
    expect(normalizeSupplierCreditNoteNumber(null)).toBeNull()
  })

  it('validates positive-only amount, supplier and reason for credit note draft', () => {
    expect(validateSupplierCreditNoteDraft({ amount: -10, supplierId: 's1', reason: 'test' }).ok).toBe(false)
    expect(validateSupplierCreditNoteDraft({ amount: 10, supplierId: '', reason: 'test' }).ok).toBe(false)
    expect(validateSupplierCreditNoteDraft({ amount: 10, supplierId: 's1', reason: '' }).ok).toBe(false)
    expect(validateSupplierCreditNoteDraft({ amount: 10, supplierId: 's1', reason: 'price correction' }).ok).toBe(true)
  })
})
