import { buildManageListsTransactionsPageQuery, fetchAllManageListsTransactions, MANAGE_LISTS_TRANSACTIONS_PAGE_SIZE } from '@/lib/manageListsTransactions'
import { buildSupplierTurnoverTotalsForYear, getSupplierYearMovementHistory } from '@/lib/manageListsSuppliers'
import { getSupplierBalanceComponents } from '@/lib/supplierCreditNote'

type Tx = {
  id: string
  supplier_id?: string | null
  fixed_asset_id?: string | null
  employee_id?: string | null
  revenue_source_id?: string | null
  type: string
  amount: number
  is_credit?: boolean | null
  date: string
  created_at?: string
  method?: string
  category?: string
  notes?: string
}

type MockCall = {
  type: 'from' | 'select' | 'eq' | 'order' | 'range'
  args: unknown[]
}

type MockQuery = {
  select: (columns: string) => MockQuery
  eq: (column: string, value: string) => MockQuery
  order: (column: string, options: { ascending: boolean }) => MockQuery
  range: (from: number, to: number) => Promise<{ data: Tx[]; error: null }>
}

type MockSupabase = {
  from: (table: 'transactions') => MockQuery
}

function makeTx(row: Tx): Tx {
  return row
}

function isoForIndex(index: number) {
  const day = String(Math.floor(index / 60) + 1).padStart(2, '0')
  const minute = String(index % 60).padStart(2, '0')
  return `2026-01-${day}T10:${minute}:00.000Z`
}

function pagedFetcher<T extends { id: string }>(rows: T[], failingPageIndex: number | null = null) {
  const calls: Array<{ from: number; to: number }> = []

  return {
    calls,
    fetchPage: async (from: number, to: number) => {
      calls.push({ from, to })
      const pageIndex = Math.floor(from / MANAGE_LISTS_TRANSACTIONS_PAGE_SIZE)
      if (failingPageIndex != null && pageIndex === failingPageIndex) {
        return { data: null, error: { message: `page ${pageIndex} failed` } }
      }
      return { data: rows.slice(from, to + 1), error: null }
    },
  }
}

describe('manage lists transaction pagination', () => {
  it('test 1: fetches all pages beyond 1000 rows and returns complete dataset', async () => {
    const rows = Array.from({ length: 1302 }, (_, index) =>
      makeTx({ id: `tx-${index + 1}`, type: 'expense', amount: -(index + 1), date: '2026-01-01', created_at: isoForIndex(index) }),
    )
    const { calls, fetchPage } = pagedFetcher(rows)

    const allRows = await fetchAllManageListsTransactions(fetchPage)

    expect(allRows).toHaveLength(1302)
    expect(calls).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
      { from: 1000, to: 1499 },
    ])
  })

  it('test 2: ALGIDA business repro uses post-boundary purchases in turnover and latest registration', async () => {
    const supplierId = '3632e51d-9e6a-4ba2-8be4-3ea4011039b0'
    const boundaryRows: Tx[] = []

    for (let index = 0; index < 996; index += 1) {
      boundaryRows.push(
        makeTx({
          id: `filler-${index + 1}`,
          supplier_id: `other-${index + 1}`,
          type: 'expense',
          amount: -1,
          is_credit: false,
          date: '2026-01-01',
          created_at: isoForIndex(index),
        }),
      )
    }

    boundaryRows.push(
      makeTx({
        id: 'algida-early-1',
        supplier_id: supplierId,
        type: 'expense',
        amount: -7379.29,
        is_credit: false,
        date: '2026-03-01',
        created_at: '2026-03-01T08:00:00.000Z',
      }),
    )

    boundaryRows.push(
      makeTx({
        id: 'c98ef615-74c9-416e-bf04-a4081af71798',
        supplier_id: supplierId,
        type: 'expense',
        amount: -321.69,
        is_credit: false,
        date: '2026-07-09',
        created_at: '2026-07-09T07:43:00.000Z',
      }),
    )

    boundaryRows.push(
      makeTx({
        id: 'algida-payment',
        supplier_id: supplierId,
        type: 'debt_payment',
        amount: -236.5,
        is_credit: false,
        date: '2026-04-20',
        created_at: '2026-04-20T08:52:00.000Z',
        method: 'Μετρητά',
      }),
    )

    boundaryRows.push(
      makeTx({
        id: 'filler-999',
        supplier_id: 'other-999',
        type: 'expense',
        amount: -2,
        is_credit: false,
        date: '2026-07-10',
        created_at: '2026-07-10T07:00:00.000Z',
      }),
    )

    boundaryRows.push(
      makeTx({
        id: '61abb0e7-45ee-4ec9-b1d5-75824d69a0ec',
        supplier_id: 'other-1000',
        type: 'expense',
        amount: -3,
        is_credit: false,
        date: '2026-07-10',
        created_at: '2026-07-10T07:01:00.000Z',
      }),
    )

    boundaryRows.push(
      makeTx({
        id: '8c9089dc-4d30-48de-9b6b-a66b2ab8099a',
        supplier_id: 'other-1001',
        type: 'expense',
        amount: -4,
        is_credit: false,
        date: '2026-07-10',
        created_at: '2026-07-10T07:02:00.000Z',
      }),
    )

    for (let index = boundaryRows.length; index < 1034; index += 1) {
      boundaryRows.push(
        makeTx({
          id: `filler-mid-${index + 1}`,
          supplier_id: `other-mid-${index + 1}`,
          type: 'expense',
          amount: -1,
          is_credit: false,
          date: '2026-07-11',
          created_at: isoForIndex(index),
        }),
      )
    }

    const postBoundaryPurchases = [
      { id: 'db215ed0-3d0a-4c25-9754-9f91464015b1', amount: 354.75, date: '2026-07-13', created_at: '2026-07-13T08:00:00.000Z' },
      { id: 'algida-2', amount: 391.87, date: '2026-07-14', created_at: '2026-07-14T08:00:00.000Z' },
      { id: 'algida-3', amount: 376.92, date: '2026-07-15', created_at: '2026-07-15T08:00:00.000Z' },
      { id: 'algida-4', amount: 402.25, date: '2026-07-16', created_at: '2026-07-16T08:00:00.000Z' },
      { id: 'algida-5', amount: 98.5, date: '2026-07-17', created_at: '2026-07-17T08:00:00.000Z' },
      { id: 'algida-6', amount: 249.66, date: '2026-07-18', created_at: '2026-07-18T08:00:00.000Z' },
      { id: 'algida-7', amount: 375.24, date: '2026-07-19', created_at: '2026-07-19T08:00:00.000Z' },
      { id: 'algida-8', amount: 648.52, date: '2026-07-20', created_at: '2026-07-20T08:00:00.000Z' },
      { id: 'algida-9', amount: 430.32, date: '2026-07-21', created_at: '2026-07-21T08:00:00.000Z' },
      { id: 'algida-10', amount: 563.16, date: '2026-08-10', created_at: '2026-08-10T08:00:00.000Z' },
      { id: 'algida-11', amount: 20.0, date: '2026-08-10', created_at: '2026-08-10T09:00:00.000Z' },
      { id: 'c77fac02-4fba-4076-954b-e03f06d1bb42', amount: 100.0, date: '2026-08-11', created_at: '2026-08-11T10:06:13.789Z' },
    ]

    for (const purchase of postBoundaryPurchases) {
      boundaryRows.push(
        makeTx({
          id: purchase.id,
          supplier_id: supplierId,
          type: 'expense',
          amount: -purchase.amount,
          is_credit: false,
          date: purchase.date,
          created_at: purchase.created_at,
        }),
      )
    }

    while (boundaryRows.length < 1302) {
      const index = boundaryRows.length + 1
      boundaryRows.push(
        makeTx({
          id: `tail-${index}`,
          supplier_id: `tail-other-${index}`,
          type: 'expense',
          amount: -1,
          is_credit: false,
          date: '2026-08-11',
          created_at: isoForIndex(index),
        }),
      )
    }

    const { fetchPage } = pagedFetcher(boundaryRows)
    const allRows = await fetchAllManageListsTransactions(fetchPage)
    const totals = buildSupplierTurnoverTotalsForYear(allRows, 2026)
    const history = getSupplierYearMovementHistory(allRows, supplierId, 2026)
    const supplierRows = allRows.filter((row) => row.supplier_id === supplierId)
    const balanceBeforeBoundaryPurchases = getSupplierBalanceComponents(
      supplierRows.filter(
        (row) =>
          row.id === 'algida-early-1' || row.id === 'c98ef615-74c9-416e-bf04-a4081af71798' || row.id === 'algida-payment',
      ),
    ).openBalance
    const balanceAfterBoundaryPurchases = getSupplierBalanceComponents(supplierRows).openBalance

    expect(allRows).toHaveLength(1302)
    expect(totals[supplierId]).toBeCloseTo(11712.17, 2)
    expect(history.annualTurnover).toBeCloseTo(11712.17, 2)
    expect(history.chargeMovements[0].id).toBe('c77fac02-4fba-4076-954b-e03f06d1bb42')
    expect(history.chargeMovements.some((row) => row.id === 'c77fac02-4fba-4076-954b-e03f06d1bb42')).toBe(true)
    expect(history.paymentMovements[0].id).toBe('algida-payment')
    expect(balanceAfterBoundaryPurchases).toBe(balanceBeforeBoundaryPurchases)
  })

  it('test 3: immediate and credit purchases both increase turnover, only credit increases debt', () => {
    const rows = [
      makeTx({ id: 'cash', supplier_id: 'sup-1', type: 'expense', amount: -100, is_credit: false, date: '2026-08-11' }),
      makeTx({ id: 'credit', supplier_id: 'sup-1', type: 'expense', amount: -200, is_credit: true, date: '2026-08-12' }),
    ]

    const totals = buildSupplierTurnoverTotalsForYear(rows, 2026)
    const balance = getSupplierBalanceComponents(rows)

    expect(totals['sup-1']).toBe(300)
    expect(balance.openBalance).toBe(200)
  })

  it('test 4: pagination query uses stable created_at and id ordering with page range', async () => {
    const calls: MockCall[] = []
    const query: MockQuery = {
      select: (columns) => {
        calls.push({ type: 'select', args: [columns] })
        return query
      },
      eq: (column, value) => {
        calls.push({ type: 'eq', args: [column, value] })
        return query
      },
      order: (column, options) => {
        calls.push({ type: 'order', args: [column, options] })
        return query
      },
      range: (from, to) => {
        calls.push({ type: 'range', args: [from, to] })
        return Promise.resolve({ data: [], error: null })
      },
    }
    const supabase: MockSupabase = {
      from: (table) => {
        calls.push({ type: 'from', args: [table] })
        return query
      },
    }

    await buildManageListsTransactionsPageQuery(supabase, 'store-1', 500, 999)

    expect(calls).toEqual([
      { type: 'from', args: ['transactions'] },
      { type: 'select', args: [expect.any(String)] },
      { type: 'eq', args: ['store_id', 'store-1'] },
      { type: 'order', args: ['created_at', { ascending: true }] },
      { type: 'order', args: ['id', { ascending: true }] },
      { type: 'range', args: [500, 999] },
    ])
  })

  it('test 5: page failure rejects without returning partial transactions', async () => {
    const rows = Array.from({ length: 1302 }, (_, index) =>
      makeTx({ id: `tx-${index + 1}`, type: 'expense', amount: -(index + 1), date: '2026-01-01', created_at: isoForIndex(index) }),
    )
    const { fetchPage } = pagedFetcher(rows, 1)

    await expect(fetchAllManageListsTransactions(fetchPage)).rejects.toMatchObject({ message: 'page 1 failed' })
  })

  it('test 6: stale request race keeps newer complete result over older late result', async () => {
    let latestRequestId = 0
    let publishedRows: string[] = []

    const publishIfCurrent = (requestId: number, rows: Array<{ id: string }>) => {
      if (requestId !== latestRequestId) return
      publishedRows = rows.map((row) => row.id)
    }

    const requestA = ++latestRequestId
    const requestB = ++latestRequestId

    publishIfCurrent(requestB, [{ id: 'newer-complete' }])
    publishIfCurrent(requestA, [{ id: 'older-late' }])

    expect(publishedRows).toEqual(['newer-complete'])
  })
})