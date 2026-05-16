import { buildFinancialComparison } from '@/lib/server/analysisComparison'

function createSupabaseForComparison(rows: any[], payrollPct = 10) {
  const state: { from?: string; to?: string } = {}

  const lte = jest.fn(async (_field: string, to: string) => {
    state.to = to
    const data = rows.filter((r) => r.date >= String(state.from) && r.date <= String(state.to))
    return { data, error: null }
  })
  const gte = jest.fn((_field: string, from: string) => {
    state.from = from
    return { lte }
  })
  const eq = jest.fn(() => ({ gte }))
  const select = jest.fn(() => ({ eq }))
  const from = jest.fn(() => ({ select }))
  const rpc = jest.fn(async () => ({ data: [{ payroll_pct: payrollPct }], error: null }))

  return { from, rpc } as any
}

describe('analysisComparison integration', () => {
  it('builds current vs previous period comparison from canonical aggregation', async () => {
    const rows = [
      { date: '2026-05-01', amount: 100, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2026-05-02', amount: -20, type: 'expense', category: 'Supplies', method: 'Cash', is_credit: false },
      { date: '2025-05-01', amount: 80, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2025-05-02', amount: -10, type: 'expense', category: 'Supplies', method: 'Cash', is_credit: false },
    ]

    const supabase = createSupabaseForComparison(rows, 11)
    const result = await buildFinancialComparison(
      supabase,
      'store-1',
      { from: '2026-05-01', to: '2026-05-02' }
    )

    expect(result.summary.totalRevenue.current).toBe(100)
    expect(result.summary.totalRevenue.previous).toBe(80)
    expect(result.summary.expenses.current).toBe(20)
    expect(result.summary.expenses.previous).toBe(10)
    expect(result.summary.profit.current).toBe(80)
    expect(result.summary.profit.previous).toBe(70)
    expect(result.summary.payrollPct.current).toBe(11)
    expect(result.daily.length).toBe(2)
  })

  it('maps 15/05/2026 to 15/05/2025 and returns previous-year totals with delta', async () => {
    const rows = [
      { date: '2026-05-15', amount: 1725, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2026-05-15', amount: -1337, type: 'expense', category: 'Ops', method: 'Cash', is_credit: false },
      { date: '2025-05-15', amount: 1420, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2025-05-15', amount: -1200, type: 'expense', category: 'Ops', method: 'Cash', is_credit: false },
    ]

    const supabase = createSupabaseForComparison(rows, 10)
    const result = await buildFinancialComparison(
      supabase,
      'store-1',
      { from: '2026-05-15', to: '2026-05-15' }
    )

    expect(result.periods.current.from).toBe('2026-05-15')
    expect(result.periods.previous.from).toBe('2025-05-15')

    expect(result.summary.totalRevenue.current).toBe(1725)
    expect(result.summary.totalRevenue.previous).toBe(1420)
    expect(result.summary.totalRevenue.delta).toBe(305)
    expect(result.summary.totalRevenue.deltaPct).toBeCloseTo((305 / 1420) * 100, 6)

    expect(result.daily).toHaveLength(1)
    expect(result.daily[0]?.currentDate).toBe('2026-05-15')
    expect(result.daily[0]?.previousDate).toBe('2025-05-15')
    expect(result.daily[0]?.previousHasData).toBe(true)
    expect(result.daily[0]?.currentRevenue).toBe(1725)
    expect(result.daily[0]?.previousRevenue).toBe(1420)
    expect(result.daily[0]?.revenueDeltaPct).toBeCloseTo((305 / 1420) * 100, 6)
  })
})
