import { getSupplierBalanceComponents } from '@/lib/supplierCreditNote'
import { fetchAllPaginatedRows, getSupplierBalanceYearBounds, type SupplierBalanceQueryRow } from '@/lib/suppliersBalanceQueries'

type TestRow = SupplierBalanceQueryRow & {
  id: string
  amount?: number
  created_at?: string
}

describe('suppliersBalanceQueries helper', () => {
  it('loads more than 1000 rows with deterministic pagination', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `row-${index + 1}`,
      date: '2026-07-01',
      type: 'expense',
      amount: -1,
      is_credit: true,
      supplier_id: 'supplier-1',
    }))

    const calls: Array<{ from: number; to: number; dateFrom?: string; dateTo?: string }> = []
    const result = await fetchAllPaginatedRows<TestRow>(async (params) => {
      calls.push(params)
      return {
        data: rows.slice(params.from, params.to + 1),
        count: rows.length,
        error: null,
      }
    }, { pageSize: 1000 })

    expect(result).toHaveLength(1001)
    expect(result[0]?.id).toBe('row-1')
    expect(result[1000]?.id).toBe('row-1001')
    expect(calls).toEqual([
      { from: 0, to: 999, dateFrom: undefined, dateTo: undefined },
      { from: 1000, to: 1999, dateFrom: undefined, dateTo: undefined },
    ])
  })

  it('passes year bounds on every page request', async () => {
    const bounds = getSupplierBalanceYearBounds(2026)
    const calls: Array<{ from: number; to: number; dateFrom?: string; dateTo?: string }> = []

    await fetchAllPaginatedRows<TestRow>(async (params) => {
      calls.push(params)
      return {
        data: params.from === 0 ? [{ id: 'row-1', date: '2026-01-01', supplier_id: 'supplier-1' }] : [],
        count: 1,
        error: null,
      }
    }, { dateFrom: bounds.from, dateTo: bounds.to, pageSize: 1000 })

    expect(calls).toEqual([
      { from: 0, to: 999, dateFrom: '2026-01-01', dateTo: '2026-12-31' },
    ])
  })

  it('deduplicates rows across pagination boundaries', async () => {
    const result = await fetchAllPaginatedRows<TestRow>(async ({ from }) => {
      if (from === 0) {
        return {
          data: [
            { id: 'row-1', date: '2026-01-01' },
            { id: 'row-2', date: '2026-01-02' },
          ],
          count: 3,
          error: null,
        }
      }

      return {
        data: [
          { id: 'row-2', date: '2026-01-02' },
          { id: 'row-3', date: '2026-01-03' },
        ],
        count: 3,
        error: null,
      }
    }, { pageSize: 2 })

    expect(result.map((row) => row.id)).toEqual(['row-1', 'row-2', 'row-3'])
  })

  it('stops when a full page repeats with no new rows', async () => {
    let callCount = 0
    const repeatedPage: TestRow[] = [
      { id: 'row-1', date: '2026-01-01' },
      { id: 'row-2', date: '2026-01-02' },
    ]

    const result = await fetchAllPaginatedRows<TestRow>(async () => {
      callCount += 1
      return {
        data: repeatedPage,
        count: null,
        error: null,
      }
    }, { pageSize: 2 })

    expect(result.map((row) => row.id)).toEqual(['row-1', 'row-2'])
    expect(callCount).toBe(2)
  })

  it('preserves deterministic ordering across pagination pages', async () => {
    const result = await fetchAllPaginatedRows<TestRow>(async ({ from }) => {
      if (from === 0) {
        return {
          data: [
            { id: 'row-1', date: '2026-01-01' },
            { id: 'row-2', date: '2026-01-02' },
          ],
          count: 4,
          error: null,
        }
      }

      return {
        data: [
          { id: 'row-3', date: '2026-01-03' },
          { id: 'row-4', date: '2026-01-04' },
        ],
        count: 4,
        error: null,
      }
    }, { pageSize: 2 })

    expect(result.map((row) => row.id)).toEqual(['row-1', 'row-2', 'row-3', 'row-4'])
  })

  it('includes a post-1000 supplier debt payment in the resulting balance', async () => {
    const filler = Array.from({ length: 1000 }, (_, index) => ({
      id: `fill-${index + 1}`,
      date: '2026-01-01',
      type: 'expense',
      amount: -1,
      is_credit: false,
      supplier_id: `other-${index + 1}`,
    }))

    const targetRows: TestRow[] = [
      { id: 'charge', date: '2026-05-01', type: 'expense', amount: -3000, is_credit: true, supplier_id: 'supplier-1' },
      { id: 'payment', date: '2026-07-17', type: 'debt_payment', amount: -3000, is_credit: false, supplier_id: 'supplier-1' },
    ]

    const allRows = [...filler, ...targetRows]
    const result = await fetchAllPaginatedRows<TestRow>(async ({ from, to }) => ({
      data: allRows.slice(from, to + 1),
      count: allRows.length,
      error: null,
    }), { pageSize: 1000 })

    const supplierRows = result.filter((row) => row.supplier_id === 'supplier-1')
    const balance = getSupplierBalanceComponents(supplierRows)

    expect(supplierRows).toHaveLength(2)
    expect(balance.openBalance).toBe(0)
  })

  it('returns the same zero balance across repeated reloads', async () => {
    const allRows: TestRow[] = [
      { id: 'charge', date: '2026-05-01', type: 'expense', amount: -3000, is_credit: true, supplier_id: 'supplier-1' },
      { id: 'payment', date: '2026-07-17', type: 'debt_payment', amount: -3000, is_credit: false, supplier_id: 'supplier-1' },
    ]

    const fetcher = async ({ from, to }: { from: number; to: number }) => ({
      data: allRows.slice(from, to + 1),
      count: allRows.length,
      error: null,
    })

    const first = await fetchAllPaginatedRows<TestRow>(fetcher, { pageSize: 1 })
    const second = await fetchAllPaginatedRows<TestRow>(fetcher, { pageSize: 1 })

    expect(getSupplierBalanceComponents(first).openBalance).toBe(0)
    expect(getSupplierBalanceComponents(second).openBalance).toBe(0)
  })

  it('keeps year filtering deterministic via explicit year bounds', async () => {
    const bounds = getSupplierBalanceYearBounds(2026)
    const result = await fetchAllPaginatedRows<TestRow>(async ({ dateFrom, dateTo }) => ({
      data: [
        { id: 'row-2026', date: dateFrom === bounds.from && dateTo === bounds.to ? '2026-04-01' : '2025-04-01', supplier_id: 'supplier-1' },
      ],
      count: 1,
      error: null,
    }), { dateFrom: bounds.from, dateTo: bounds.to })

    expect(result).toEqual([
      { id: 'row-2026', date: '2026-04-01', supplier_id: 'supplier-1' },
    ])
  })

  it('keeps voided payments excluded from the computed balance', async () => {
    const rows: TestRow[] = [
      { id: 'charge', date: '2026-05-01', type: 'expense', amount: -3000, is_credit: true, supplier_id: 'supplier-1' },
      { id: 'voided-payment', date: '2026-07-17', type: 'debt_payment', amount: -3000, is_credit: false, supplier_id: 'supplier-1', voided_at: '2026-07-17T12:00:00Z' },
    ]

    const balance = getSupplierBalanceComponents(rows)

    expect(balance.payments).toBe(0)
    expect(balance.openBalance).toBe(3000)
  })
})