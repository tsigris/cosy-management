import type { SupabaseClient } from '@supabase/supabase-js'

export type StoreCard = {
  id: string
  name: string
  income?: number
  expenses?: number
  profit?: number
  lastUpdated?: string | null
}

export async function fetchStoresForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<StoreCard[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('user_id', userId)
    .order('name')

  if (error) throw error

  return (data ?? []) as StoreCard[]
}