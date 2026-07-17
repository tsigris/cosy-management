import { getYearRange } from '@/lib/financialPeriods'

type QueryErrorLike = {
  message?: string
  details?: string
  hint?: string
}

type PaginatedRowsResponse<Row> = {
  data: Row[] | null
  count: number | null
  error: QueryErrorLike | null
}

type FetchPageParams = {
  from: number
  to: number
  dateFrom?: string
  dateTo?: string
}

type FetchPage<Row> = (params: FetchPageParams) => Promise<PaginatedRowsResponse<Row>>

type FetchAllOptions<Row> = {
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  getRowKey?: (row: Row) => string | null
}

export type SupplierBalanceQueryRow = {
  id?: string | null
  date?: string | null
  type?: string | null
  is_credit?: boolean | null
  supplier_id?: string | null
  fixed_asset_id?: string | null
  revenue_source_id?: string | null
  voided_at?: string | null
}

const DEFAULT_PAGE_SIZE = 1000

function defaultRowKey<Row extends { id?: string | null }>(row: Row) {
  return row.id ? String(row.id) : null
}

export async function fetchAllPaginatedRows<Row extends { id?: string | null }>(
  fetchPage: FetchPage<Row>,
  options: FetchAllOptions<Row> = {},
) {
  const pageSize = Math.max(1, Math.floor(options.pageSize || DEFAULT_PAGE_SIZE))
  const getRowKey = options.getRowKey || defaultRowKey<Row>
  const seenKeys = new Set<string>()
  const rows: Row[] = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const result = await fetchPage({
      from,
      to,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    })

    if (result.error) throw result.error

    const pageRows = Array.isArray(result.data) ? result.data : []
    let addedCount = 0

    for (const row of pageRows) {
      const rowKey = getRowKey(row)
      if (rowKey && seenKeys.has(rowKey)) continue
      if (rowKey) seenKeys.add(rowKey)
      rows.push(row)
      addedCount += 1
    }

    if (result.count !== null && to + 1 >= result.count) break
    if (pageRows.length < pageSize) break

    // Safety valve: if the server keeps returning a full page but no new rows,
    // stop to avoid an endless loop on repeated page payloads.
    if (addedCount === 0) break
  }

  return rows
}

export function getSupplierBalanceYearBounds(year: number) {
  return getYearRange(year)
}
