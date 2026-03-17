import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated?: string | null
}

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  // Το userId πλέον δεν χρησιμοποιείται για filtering στη βάση (το κάνει το auth.uid() μέσω view),
  // αλλά το κρατάμε για να μην πειράξουμε τα calls στο project.
  if (!userId) return []

  const supabase = getSupabase()

  // ✅ Ασφαλές: το view επιστρέφει ΜΟΝΟ stores που έχει ο τρέχων χρήστης (auth.uid()) από store_access
  const { data, error } = await supabase
    .from('v_my_store_stats')
    .select('id, name, income, expenses, profit, last_updated')
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchStoresForUser v_my_store_stats error:', error)
    throw error
  }

  const storeIds = (data ?? []).map((row: any) => String(row.id)).filter(Boolean)
  let latestTxByStoreId: Record<string, string> = {}

  if (storeIds.length > 0) {
    const { data: txRows, error: txError } = await supabase
      .from('transactions')
      .select('store_id, created_at')
      .in('store_id', storeIds)
      .not('created_at', 'is', null)
      .order('created_at', { ascending: false })

    if (txError) {
      console.error('fetchStoresForUser latest transactions error:', txError)
    } else {
      latestTxByStoreId = (txRows ?? []).reduce((acc: Record<string, string>, tx: any) => {
        const storeId = String(tx?.store_id || '')
        const createdAt = tx?.created_at ? String(tx.created_at) : ''
        if (!storeId || !createdAt || acc[storeId]) return acc
        acc[storeId] = createdAt
        return acc
      }, {})
    }
  }

  return (data ?? []).map((row: any) => {
    const income = Number(row.income) || 0
    const expenses = Number(row.expenses) || 0
    const storeId = String(row.id)
    const lastUpdated = latestTxByStoreId[storeId] ?? (row.last_updated ? String(row.last_updated) : null)

    return {
      id: storeId,
      name: String(row.name || ''),
      income,
      expenses,
      // Expenses are stored as negative values, so net is income + expenses.
      profit: income + expenses,
      lastUpdated,
    }
  })
}