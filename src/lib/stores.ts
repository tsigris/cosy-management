'use client'

import { getSupabaseBrowser } from '@/lib/supabase-browser'

const STORES_CACHE_PREFIX = 'cosy-stores:v1:'

export type StoreCard = {
  id: string
  name: string
  income?: number
  expenses?: number
  profit?: number
  lastUpdated?: string | null
}

// --- Helpers ---
function cacheKeyForUser(userId: string) {
  return `${STORES_CACHE_PREFIX}${userId}`
}

function safeReadLocalStorage(key: string) {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function safeRemoveLocalStorage(key: string) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// --- Public API ---
export function clearStoresCacheForUser(userId: string) {
  safeRemoveLocalStorage(cacheKeyForUser(userId))
}

export async function getStoresCachedForUser(userId: string): Promise<StoreCard[] | null> {
  const raw = safeReadLocalStorage(cacheKeyForUser(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed as StoreCard[]
  } catch {
    return null
  }
}

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  const supabase = getSupabaseBrowser()
  if (!supabase) {
    console.error('Supabase browser client not available (fetchStoresForUser)')
    return []
  }

  // Αν έχεις πίνακα stores + store_access:
  // - stores: id, name
  // - store_access: user_id, store_id, role, ...
  const { data, error } = await supabase
    .from('store_access')
    .select('store_id, stores:stores(id, name)')
    .eq('user_id', userId)

  if (error) {
    console.error('fetchStoresForUser error:', error)
    return []
  }

  const rows = (data || [])
    .map((r: any) => ({
      id: String(r?.stores?.id || r?.store_id || ''),
      name: String(r?.stores?.name || 'ΚΑΤΑΣΤΗΜΑ'),
      income: 0,
      expenses: 0,
      profit: 0,
      lastUpdated: null,
    }))
    .filter((x) => x.id)

  // Cache
  safeWriteLocalStorage(cacheKeyForUser(userId), JSON.stringify(rows))

  return rows
}