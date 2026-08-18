import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialDateRange } from '@/lib/financialPeriods'

type FetchAllTransactionsForFinancialRangeOptions = {
  storeId: string
  range: FinancialDateRange
  select: string
  ascending?: boolean
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 1000

/**
 * Fetch all transactions in a deterministic, paginated way.
 * Prevents silent 1000-row truncation from PostgREST default limits.
 */
export async function fetchAllTransactionsForFinancialRange<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  options: FetchAllTransactionsForFinancialRangeOptions,
): Promise<T[]> {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE))
  const allRows: T[] = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('transactions')
      .select(options.select)
      .eq('store_id', options.storeId)
      .gte('date', options.range.from)
      .lte('date', options.range.to)
      .order('date', { ascending: options.ascending ?? false })
      .order('created_at', { ascending: options.ascending ?? false })
      .order('id', { ascending: options.ascending ?? false })
      .range(from, to)

    if (error) throw error

    const rows = Array.isArray(data) ? (data as T[]) : []
    allRows.push(...rows)

    if (rows.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}
