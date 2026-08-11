export const MANAGE_LISTS_TRANSACTIONS_PAGE_SIZE = 500

export const MANAGE_LISTS_TRANSACTION_SELECT =
  'id, amount, supplier_id, fixed_asset_id, employee_id, revenue_source_id, type, category, method, date, created_at, notes, is_credit, linked_invoice_tx_id, supplier_credit_note_number, voided_at, voided_by, void_reason'

type TransactionsQueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

type TransactionsPageFetcher<T> = (from: number, to: number) => Promise<TransactionsQueryResult<T>>

type TransactionsPageQuery = {
  select(columns: string): TransactionsPageQuery
  eq(column: string, value: string): TransactionsPageQuery
  order(column: string, options: { ascending: boolean }): TransactionsPageQuery
  range(from: number, to: number): Promise<TransactionsQueryResult<unknown>>
}

type TransactionsSupabaseLike = {
  from(table: 'transactions'): TransactionsPageQuery
}

function getRowId(row: unknown) {
  if (!row || typeof row !== 'object') return ''
  return String((row as { id?: unknown }).id || '').trim()
}

export async function fetchAllManageListsTransactions<T>(
  fetchPage: TransactionsPageFetcher<T>,
  pageSize = MANAGE_LISTS_TRANSACTIONS_PAGE_SIZE,
) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Invalid Manage Lists transaction page size')
  }

  const merged = new Map<string, T>()
  let pageIndex = 0

  while (true) {
    const from = pageIndex * pageSize
    const to = from + pageSize - 1
    const result = await fetchPage(from, to)

    if (result.error) {
      throw result.error
    }

    const rows = result.data || []
    for (const row of rows) {
      const rowId = getRowId(row)
      if (!rowId) {
        throw new Error('Manage Lists transactions page returned a row without id')
      }
      if (merged.has(rowId)) {
        throw new Error(`Duplicate transaction id encountered while paginating Manage Lists data: ${rowId}`)
      }
      merged.set(rowId, row)
    }

    if (rows.length < pageSize) {
      return Array.from(merged.values())
    }

    pageIndex += 1
  }
}

export function buildManageListsTransactionsPageQuery(
  supabase: unknown,
  activeStoreId: string,
  from: number,
  to: number,
) {
  const client = supabase as TransactionsSupabaseLike

  return client
    .from('transactions')
    .select(MANAGE_LISTS_TRANSACTION_SELECT)
    .eq('store_id', activeStoreId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to)
}