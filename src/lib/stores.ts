import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated?: string | null
}

const supabase = getSupabase()

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('v_financial_summary')
    .select(`
      store_id,
      store_name,
      owner_id,
      income,
      expenses,
      profit,
      last_updated
    `)
    .eq('owner_id', userId)
    .order('store_name')

  if (error) {
    console.error('fetchStoresForUser error:', error)
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: row.store_id,
    name: row.store_name,
    income: Number(row.income) || 0,
    expenses: Number(row.expenses) || 0,
    profit: Number(row.profit) || 0,
    lastUpdated: row.last_updated ?? null,
  }))
}