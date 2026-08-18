import { buildFinancialComparison } from '@/lib/server/analysisComparison'

type TestRow = {
  id?: string | number
  date: string
  amount: number
  type: string
  category?: string
  method?: string
  notes?: string
  is_credit?: boolean
}

type ComparisonSupabaseMock = {
  from: jest.Mock
  rpc: jest.Mock
  queryBuilder: {
    range: jest.Mock
  }
}

function createSupabaseForComparison(rows: TestRow[], payrollPct = 10): ComparisonSupabaseMock {
  const state: {
    from?: string
    to?: string
  } = {}

  const queryBuilder = {
    select: jest.fn(() => queryBuilder),
    eq: jest.fn(() => queryBuilder),
    gte: jest.fn((_field: string, from: string) => {
      state.from = from
      return queryBuilder
    }),
    lte: jest.fn((_field: string, to: string) => {
      state.to = to
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

  const from = jest.fn(() => queryBuilder)
  const rpc = jest.fn(async () => ({ data: [{ payroll_pct: payrollPct }], error: null }))

  return { from, rpc, queryBuilder }
}

describe('analysisComparison integration', () => {
  it('builds current vs previous period comparison with strict calendar mapping', async () => {
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
    
    // Verify comparisonMapping is included
    expect(result.comparisonMapping).toBeDefined()
    expect(result.comparisonMapping.currentDate).toBe('2026-05-01')
    expect(result.comparisonMapping.comparisonDate).toBe('2025-05-01')
  })

  it('maps 2026-05-15 to 2025-05-15 in calendar mode', async () => {
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
    
    // Verify comparisonMapping is included and correct
    expect(result.comparisonMapping).toBeDefined()
    expect(result.comparisonMapping.currentDate).toBe('2026-05-15')
    expect(result.comparisonMapping.comparisonDate).toBe('2025-05-15')
  })

  it('loads all pages when comparison range returns more than 1000 rows', async () => {
    const currentRows = Array.from({ length: 1205 }, (_, idx) => ({
      id: `c-${idx + 1}`,
      date: '2026-05-14',
      amount: 1,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    }))
    const previousRows = Array.from({ length: 1205 }, (_, idx) => ({
      id: `p-${idx + 1}`,
      date: '2025-05-14',
      amount: 1,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    }))

    const supabase = createSupabaseForComparison([...currentRows, ...previousRows], 10)
    const result = await buildFinancialComparison(
      supabase,
      'store-1',
      { from: '2026-05-14', to: '2026-05-14' }
    )

    expect(result.summary.totalRevenue.current).toBe(1205)
    expect(result.summary.totalRevenue.previous).toBe(1205)
    expect(result.summary.totalRevenue.delta).toBe(0)
    expect(supabase.queryBuilder.range).toHaveBeenCalledTimes(4)
  })

  it('keeps canonical current and comparison current consistent for same rows', async () => {
    const rows = [
      { date: '2026-05-01', amount: 100, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2026-05-01', amount: -10, type: 'expense', category: 'Ops', method: 'Cash', is_credit: false },
      { date: '2026-05-02', amount: 50, type: 'income', category: 'Sales', method: 'Card', is_credit: false },
      { date: '2025-05-01', amount: 40, type: 'income', category: 'Sales', method: 'Cash', is_credit: false },
      { date: '2025-05-02', amount: 20, type: 'income', category: 'Sales', method: 'Card', is_credit: false },
    ]

    const supabase = createSupabaseForComparison(rows, 9)
    const result = await buildFinancialComparison(
      supabase,
      'store-1',
      { from: '2026-05-01', to: '2026-05-02' }
    )

    expect(result.summary.totalRevenue.current).toBe(150)
    expect(result.daily[result.daily.length - 1]?.currentCumulativeRevenue).toBe(150)
  })
})
