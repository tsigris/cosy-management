import { supabase } from '@/lib/supabase'

const STORES_CACHE_PREFIX = 'cosy:stores:v1:'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated: string | null
}

export type StoresFetchResult = {
  stores: StoreCard[]
  accessWarning: string
}

type StoresCachePayload = {
  stores: StoreCard[]
  accessWarning: string
  updatedAt: number
}

const getStoresCacheKey = (userId: string) => `${STORES_CACHE_PREFIX}${userId}`

export const readStoresCache = (userId: string): StoresCachePayload | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(getStoresCacheKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoresCachePayload
    if (!parsed || !Array.isArray(parsed.stores)) return null

    return {
      stores: parsed.stores,
      accessWarning: typeof parsed.accessWarning === 'string' ? parsed.accessWarning : '',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
    }
  } catch {
    return null
  }
}

export const writeStoresCache = (userId: string, payload: StoresFetchResult) => {
  if (typeof window === 'undefined') return

  const value: StoresCachePayload = {
    stores: payload.stores,
    accessWarning: payload.accessWarning,
    updatedAt: Date.now()
  }

  localStorage.setItem(getStoresCacheKey(userId), JSON.stringify(value))
}

export const fetchStoresWithStats = async (userId: string): Promise<StoresFetchResult> => {
  void userId

  type StoresStatsRpcRow = {
    store_id: string | null
    store_name: string | null
    income: number | string | null
    expenses: number | string | null
    profit: number | string | null
    last_updated: string | null
  }

  try {
    const { data, error } = await supabase.rpc('get_user_stores_with_monthly_stats')

    if (error) {
      throw error
    }

    const rows = (data ?? []) as StoresStatsRpcRow[]

    if (rows.length === 0) {
      return {
        stores: [],
        accessWarning: ''
      }
    }

    const stores: StoreCard[] = rows
      .filter((row) => row.store_id)
      .map((row) => {
        const income = Number(row.income) || 0
        const expenses = Number(row.expenses) || 0
        const profit = Number(row.profit)

        return {
          id: String(row.store_id),
          name: String(row.store_name || 'Κατάστημα'),
          income,
          expenses,
          profit: Number.isFinite(profit) ? profit : income - expenses,
          lastUpdated: row.last_updated || null,
        }
      })

    return {
      stores,
      accessWarning: ''
    }
  } catch (error) {
    console.error('fetchStoresWithStats fallback to cache:', error)
    const cached = readStoresCache(userId)

    if (cached) {
      return {
        stores: cached.stores,
        accessWarning: cached.accessWarning,
      }
    }

    return {
      stores: [],
      accessWarning: ''
    }
  }
}

export const refreshStoresCache = async (userId: string) => {
  const result = await fetchStoresWithStats(userId)
  writeStoresCache(userId, result)
  return result
}

export const prefetchStoresForUser = async (userId: string): Promise<StoresFetchResult | null> => {
  try {
    const result = await fetchStoresWithStats(userId)
    writeStoresCache(userId, result)
    const cached = readStoresCache(userId)
    if (!cached) {
      throw new Error('Αποτυχία αποθήκευσης stores στο localStorage.')
    }
    return result
  } catch (e) {
    console.error("Prefetch error:", e)
    return null
  }
}