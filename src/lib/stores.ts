import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income?: number
  expenses?: number
  profit?: number
  lastUpdated?: string | null
}

const supabase = getSupabase()

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  if (!userId) return []

  // παίρνουμε stores μέσω store_members
  const { data, error } = await supabase
    .from('store_members')
    .select(`
      store_id,
      stores (
        id,
        name,
        created_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error(error)
    throw error
  }

  if (!data) return []

  return data
    .map((row: any) => ({
      id: row.stores.id,
      name: row.stores.name,
      lastUpdated: row.stores.created_at,
      income: 0,
      expenses: 0,
      profit: 0,
    }))
}