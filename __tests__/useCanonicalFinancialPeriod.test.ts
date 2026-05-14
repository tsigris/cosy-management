import { renderHook, waitFor } from '@testing-library/react'
import { useCanonicalFinancialPeriod } from '@/hooks/useCanonicalFinancialPeriod'

function createSupabaseMock(rows: any[], payrollPct = 0) {
  const queryResult = { data: rows, error: null }
  const orderSecond = jest.fn().mockResolvedValue(queryResult)
  const orderFirst = jest.fn().mockReturnValue({ order: orderSecond })
  const lte = jest.fn().mockReturnValue({ order: orderFirst })
  const gte = jest.fn().mockReturnValue({ lte })
  const eq = jest.fn().mockReturnValue({ gte })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  const rpc = jest.fn().mockResolvedValue({ data: [{ payroll_pct: payrollPct }], error: null })

  return { from, rpc }
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
