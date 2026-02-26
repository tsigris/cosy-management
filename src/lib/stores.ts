import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated?: string | null
}

export async function fetchStoresForUser(): Promise<StoreCard[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('v_my_store_stats')
    .select('id, name, income, expenses, profit, last_updated')
    .order('name')

  if (error) {
    console.error('fetchStoresForUser error:', error)
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