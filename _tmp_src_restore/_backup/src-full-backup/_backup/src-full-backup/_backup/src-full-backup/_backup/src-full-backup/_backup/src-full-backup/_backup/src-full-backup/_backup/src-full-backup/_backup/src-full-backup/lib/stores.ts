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
  if (!userId) return []

  const supabase = getSupabase()

  // Canonical mapping user -> stores
  const { data: accessRows, error: accessError } = await supabase
    .from('store_access')
    .select('store_id')
    .eq('user_id', userId)

  if (accessError) {
    console.error('fetchStoresForUser access error:', accessError)
    throw accessError
  }

  const accessStoreIds = Array.from(
    new Set((accessRows ?? []).map((r: any) => String(r.store_id)).filter(Boolean))
  )

  if (accessStoreIds.length === 0) {
    return []
  }

  const query = supabase
    .from('v_store_stats')
    .select('id, name, income, expenses, profit, last_updated')
    .in('id', accessStoreIds)
    .order('name')

  const { data, error } = await query

  if (error) {
    console.error('fetchStoresForUser stats error:', error)
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: row.name,
    income: Number(row.income) || 0,
    expenses: Number(row.expenses) || 0,
    profit: Number(row.profit) || 0,
    lastUpdated: row.last_updated ?? null,
  }))
}