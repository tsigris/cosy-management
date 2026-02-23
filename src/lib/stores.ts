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

  // 1) Φέρνουμε όλα τα stores που έχει πρόσβαση ο χρήστης (invites / staff / admin)
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

  // 2) Φέρνουμε stats για:
  // - stores που είναι owner ο user
  // - stores που έχει access μέσω store_access
  let query = supabase
    .from('v_store_stats')
    .select('id, name, owner_id, income, expenses, profit, last_updated')
    .order('name')

  if (accessStoreIds.length > 0) {
    // Supabase "or" syntax: owner_id.eq.<id>,id.in.(a,b,c)
    const inList = accessStoreIds.join(',')
    query = query.or(`owner_id.eq.${userId},id.in.(${inList})`)
  } else {
    query = query.eq('owner_id', userId)
  }

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