// src/lib/stores.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type StoreCard = {
  id: string
  name: string
  income?: number
  expenses?: number
  profit?: number
  lastUpdated?: string | null
}

/**
 * Server-safe + Client-safe:
 * Δεν έχει 'use client'
 * Δεν ακουμπάει window/localStorage
 * Θέλει Supabase client να του το δώσεις απ' έξω
 */
export async function fetchStoresForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<StoreCard[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as StoreCard[]
}