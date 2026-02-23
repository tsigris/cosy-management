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

  const { data, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', userId) // ✅ FIX
    .order('name')

  if (error) throw error

  return (data ?? []) as StoreCard[]
}