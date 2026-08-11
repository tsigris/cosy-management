import {
  buildSupplierTurnoverTotalsForYear,
  getSupplierYearMovementHistory,
  hasDeterministicSupplierInvoicePaymentLink,
} from '@/lib/manageListsSuppliers'

type Tx = {
  id: string
  supplier_id?: string | null
  fixed_asset_id?: string | null
  type: string
  amount: number
  date: string
  notes?: string
  method?: string
  linked_invoice_tx_id?: string | null
}

function tx(row: Tx) {
  return row
}

describe('manage lists suppliers turnover and yearly movements', () => {
  it('test 1: 2026 purchases 20000 and payments 10000 keeps headline turnover 20000', () => {
    const rows = [
      tx({ id: 'p1', supplier_id: 'sup-1', type: 'expense', amount: -12000, date: '2026-01-10' }),
      tx({ id: 'p2', supplier_id: 'sup-1', type: 'expense', amount: -8000, date: '2026-03-01' }),
      tx({ id: 'pay1', supplier_id: 'sup-1', type: 'debt_payment', amount: -4000, date: '2026-04-15' }),
      tx({ id: 'pay2', supplier_id: 'sup-1', type: 'debt_payment', amount: -6000, date: '2026-05-20' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)
    const history = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(totals['sup-1']).toBe(20000)
    expect(history.annualTurnover).toBe(20000)
    expect(history.paymentMovements).toHaveLength(2)
  })

  it('test 2: purchase and two payments keep three dated movements while turnover stays purchase-only', () => {
    const rows = [
      tx({ id: 'p', supplier_id: 'sup-1', type: 'expense', amount: -5000, date: '2026-03-01' }),
      tx({ id: 'pay-a', supplier_id: 'sup-1', type: 'debt_payment', amount: -3000, date: '2026-04-15', method: 'Τράπεζα' }),
      tx({ id: 'pay-b', supplier_id: 'sup-1', type: 'debt_payment', amount: -2000, date: '2026-05-20', method: 'Μετρητά' }),
    ]

    const history = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(history.annualTurnover).toBe(5000)
    expect(history.chargeMovements).toHaveLength(1)
    expect(history.paymentMovements).toHaveLength(2)
    expect(history.paymentMovements.map((m) => m.date)).toEqual(['2026-05-20', '2026-04-15'])
  })

  it('test 3: debt_payment does not reduce annual turnover', () => {
    const rows = [
      tx({ id: 'p', supplier_id: 'sup-1', type: 'expense', amount: -5000, date: '2026-03-01' }),
      tx({ id: 'pay', supplier_id: 'sup-1', type: 'debt_payment', amount: -5000, date: '2026-04-01' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)
    expect(totals['sup-1']).toBe(5000)
  })

  it('test 4: multiple payments remain independent movement entries', () => {
    const rows = [
      tx({ id: 'pay-1', supplier_id: 'sup-1', type: 'debt_payment', amount: -1000, date: '2026-04-01' }),
      tx({ id: 'pay-2', supplier_id: 'sup-1', type: 'debt_payment', amount: -1500, date: '2026-04-03' }),
      tx({ id: 'pay-3', supplier_id: 'sup-1', type: 'debt_payment', amount: -500, date: '2026-04-05' }),
    ]

    const history = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(history.paymentMovements).toHaveLength(3)
    expect(history.paymentMovements.map((m) => m.id)).toEqual(['pay-3', 'pay-2', 'pay-1'])
  })

  it('test 5: supplier credit note appears in movements but does not change turnover source', () => {
    const rows = [
      tx({ id: 'exp-1', supplier_id: 'sup-1', type: 'expense', amount: -10000, date: '2026-01-01' }),
      tx({ id: 'cn-1', supplier_id: 'sup-1', type: 'supplier_credit_note', amount: 1500, date: '2026-02-01' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)
    const history = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(totals['sup-1']).toBe(10000)
    expect(history.annualTurnover).toBe(10000)
    expect(history.chargeMovements.map((m) => m.type)).toEqual(['supplier_credit_note', 'expense'])
  })

  it('test 6: 2025 purchase does not enter 2026 turnover', () => {
    const rows = [
      tx({ id: 'exp-2025', supplier_id: 'sup-1', type: 'expense', amount: -15000, date: '2025-12-30' }),
      tx({ id: 'exp-2026', supplier_id: 'sup-1', type: 'expense', amount: -20000, date: '2026-01-02' }),
    ]

    const totals2025 = buildSupplierTurnoverTotalsForYear(rows, 2025)
    const totals2026 = buildSupplierTurnoverTotalsForYear(rows, 2026)

    expect(totals2025['sup-1']).toBe(15000)
    expect(totals2026['sup-1']).toBe(20000)
  })

  it('test 7: payment against previous-year debt appears in 2026 movements but creates no 2026 turnover', () => {
    const rows = [
      tx({ id: 'exp-old', supplier_id: 'sup-1', type: 'expense', amount: -10000, date: '2025-06-01' }),
      tx({ id: 'pay-now', supplier_id: 'sup-1', type: 'debt_payment', amount: -3000, date: '2026-02-15' }),
    ]

    const totals2026 = buildSupplierTurnoverTotalsForYear(rows, 2026)
    const history2026 = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(totals2026['sup-1'] || 0).toBe(0)
    expect(history2026.annualTurnover).toBe(0)
    expect(history2026.paymentMovements).toHaveLength(1)
    expect(history2026.paymentMovements[0].id).toBe('pay-now')
  })

  it('test 8: headline turnover source equals ranking turnover source', () => {
    const rows = [
      tx({ id: 'exp-1', supplier_id: 'sup-1', type: 'expense', amount: -6000, date: '2026-01-01' }),
      tx({ id: 'exp-2', supplier_id: 'sup-1', type: 'expense', amount: -4000, date: '2026-03-01' }),
      tx({ id: 'pay-1', supplier_id: 'sup-1', type: 'debt_payment', amount: -5000, date: '2026-03-10' }),
    ]

    const rankingSource = buildSupplierTurnoverTotalsForYear(rows, 2026)['sup-1']
    const headlineSource = getSupplierYearMovementHistory(rows, 'sup-1', 2026).annualTurnover

    expect(headlineSource).toBe(rankingSource)
  })

  it('test 9: changing selected year changes both turnover and movements', () => {
    const rows = [
      tx({ id: 'exp-2025', supplier_id: 'sup-1', type: 'expense', amount: -15000, date: '2025-02-01' }),
      tx({ id: 'pay-2025', supplier_id: 'sup-1', type: 'debt_payment', amount: -1000, date: '2025-03-01' }),
      tx({ id: 'exp-2026', supplier_id: 'sup-1', type: 'expense', amount: -20000, date: '2026-02-01' }),
      tx({ id: 'pay-2026', supplier_id: 'sup-1', type: 'debt_payment', amount: -2000, date: '2026-03-01' }),
    ]

    const y2025 = getSupplierYearMovementHistory(rows, 'sup-1', 2025)
    const y2026 = getSupplierYearMovementHistory(rows, 'sup-1', 2026)

    expect(y2025.annualTurnover).toBe(15000)
    expect(y2026.annualTurnover).toBe(20000)
    expect(y2025.paymentMovements).toHaveLength(1)
    expect(y2026.paymentMovements).toHaveLength(1)
    expect(y2025.paymentMovements[0].id).toBe('pay-2025')
    expect(y2026.paymentMovements[0].id).toBe('pay-2026')
  })

  it('test 10: outstanding debt does not affect annual turnover', () => {
    const rows = [
      tx({ id: 'exp', supplier_id: 'sup-1', type: 'expense', amount: -10000, date: '2026-01-01' }),
      tx({ id: 'pay', supplier_id: 'sup-1', type: 'debt_payment', amount: -2000, date: '2026-04-01' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)
    expect(totals['sup-1']).toBe(10000)
  })

  it('test 11: non-supplier movements do not change supplier turnover totals', () => {
    const rows = [
      tx({ id: 'supplier-exp', supplier_id: 'sup-1', type: 'expense', amount: -3000, date: '2026-01-01' }),
      tx({ id: 'asset-exp', fixed_asset_id: 'fa-1', type: 'expense', amount: -9999, date: '2026-01-02' }),
      tx({ id: 'orphan-exp', type: 'expense', amount: -1111, date: '2026-01-03' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)

    expect(totals['sup-1']).toBe(3000)
    expect(Object.keys(totals)).toEqual(['sup-1'])
  })

  it('test 12: deterministic invoice-payment linkage is absent unless explicit payment link field exists', () => {
    const noLinkRows = [
      tx({ id: 'exp', supplier_id: 'sup-1', type: 'expense', amount: -5000, date: '2026-01-01' }),
      tx({ id: 'pay', supplier_id: 'sup-1', type: 'debt_payment', amount: -2000, date: '2026-01-10', linked_invoice_tx_id: null }),
    ]
    expect(hasDeterministicSupplierInvoicePaymentLink(noLinkRows)).toBe(false)

    const explicitLinkRows = [
      tx({ id: 'pay-linked', supplier_id: 'sup-1', type: 'debt_payment', amount: -2000, date: '2026-01-10', linked_invoice_tx_id: 'tx-invoice-1' }),
    ]
    expect(hasDeterministicSupplierInvoicePaymentLink(explicitLinkRows)).toBe(true)
  })
})
