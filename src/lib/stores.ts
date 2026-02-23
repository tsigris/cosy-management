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

  const { data, error } = await supabase
    .from('v_store_stats')
    .select('id, name, owner_id, income, expenses, profit, last_updated')
    .eq('owner_id', userId)
    .order('name')

  if (error) {
    console.error('fetchStoresForUser error:', error)
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    income: Number(row.income) || 0,
    expenses: Number(row.expenses) || 0,
    profit: Number(row.profit) || 0,
    lastUpdated: row.last_updated ?? null,
  }))
}