import { renderHook, waitFor } from '@testing-library/react'
import { useCanonicalFinancialPeriod } from '@/hooks/useCanonicalFinancialPeriod'

type TestRow = {
  id?: string | number
  date: string
  amount: number
  type: string
  category?: string
  method?: string
  is_credit?: boolean
}

function createSupabaseMock(rows: TestRow[], payrollPct = 0) {
  const state: {
    storeId?: string
    from?: string
    to?: string
  } = {}

  const queryBuilder = {
    select: jest.fn(() => queryBuilder),
    eq: jest.fn((_field: string, value: string) => {
      state.storeId = value
      return queryBuilder
    }),
    gte: jest.fn((_field: string, value: string) => {
      state.from = value
      return queryBuilder
    }),
    lte: jest.fn((_field: string, value: string) => {
      state.to = value
      return queryBuilder
    }),
    order: jest.fn(() => queryBuilder),
    range: jest.fn(async (fromIdx: number, toIdx: number) => {
      const filtered = rows
        .filter((row) => row.date >= String(state.from) && row.date <= String(state.to))
        .slice(fromIdx, toIdx + 1)
      return { data: filtered, error: null }
    }),
  }

  const from = jest.fn().mockReturnValue(queryBuilder)
  const rpc = jest.fn().mockResolvedValue({ data: [{ payroll_pct: payrollPct }], error: null })

  return { from, rpc, queryBuilder }
}

describe('useCanonicalFinancialPeriod', () => {
  it('loads summary and rows when enabled', async () => {
    const range = { from: '2026-05-01', to: '2026-05-31' }
    const rows = [
      {
        date: '2026-05-14',
        amount: 100,
        type: 'income',
        category: 'Sales',
        method: 'Cash',
        is_credit: false,
      },
      {
        date: '2026-05-14',
        amount: -40,
        type: 'expense',
        category: 'Supplies',
        method: 'Cash',
        is_credit: false,
      },
    ]

    const supabase = createSupabaseMock(rows, 12)
    const { getSupabase } = jest.requireMock('@/lib/supabase') as { getSupabase: jest.Mock }
    getSupabase.mockReturnValue(supabase)

    const { result } = renderHook(() =>
      useCanonicalFinancialPeriod({
        storeId: 'store-1',
        range,
        enabled: true,
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.summary).not.toBeNull()
    })

    expect(result.current.rows).toHaveLength(2)
    expect(result.current.summary?.totalRevenue).toBe(100)
    expect(result.current.summary?.totalExpenses).toBe(40)
    expect(result.current.summary?.profit).toBe(60)
    expect(result.current.summary?.payrollPct).toBe(12)
  })

  it('loads all pages when period contains more than 1000 rows', async () => {
    const range = { from: '2026-05-01', to: '2026-05-31' }
    const rows = Array.from({ length: 1205 }, (_, index) => ({
      id: index + 1,
      date: '2026-05-14',
      amount: 1,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    }))

    const supabase = createSupabaseMock(rows, 0)
    const { getSupabase } = jest.requireMock('@/lib/supabase') as { getSupabase: jest.Mock }
    getSupabase.mockReturnValue(supabase)

    const { result } = renderHook(() =>
      useCanonicalFinancialPeriod({
        storeId: 'store-1',
        range,
        enabled: true,
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.summary).not.toBeNull()
    })

    expect(result.current.rows).toHaveLength(1205)
    expect(result.current.summary?.totalRevenue).toBe(1205)
    expect(supabase.queryBuilder.range).toHaveBeenCalledTimes(2)
    expect(supabase.queryBuilder.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(supabase.queryBuilder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('resets state when disabled or storeId missing', async () => {
    const range = { from: '2026-05-01', to: '2026-05-31' }
    const initialProps: { enabled: boolean; storeId: string | null } = {
      enabled: false,
      storeId: null,
    }

    const { result, rerender } = renderHook(
      (props: { enabled: boolean; storeId: string | null }) =>
        useCanonicalFinancialPeriod({
          storeId: props.storeId,
          range,
          enabled: props.enabled,
        }),
      { initialProps }
    )

    expect(result.current.summary).toBeNull()
    expect(result.current.rows).toEqual([])
    expect(result.current.error).toBeNull()

    rerender({ enabled: false, storeId: 'store-1' })
    expect(result.current.summary).toBeNull()
    expect(result.current.rows).toEqual([])
  })
})
