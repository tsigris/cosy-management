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
  let accessWarning = ''

  const [ownedStoresRes, accessBeforeRepairRes] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name')
      .eq('owner_id', userId),
    supabase
      .from('store_access')
      .select('store_id')
      .eq('user_id', userId)
  ])

  const { data: ownedStores, error: ownedStoresError } = ownedStoresRes
  const { data: myAccessBeforeRepair, error: beforeRepairError } = accessBeforeRepairRes

  if (ownedStoresError) throw ownedStoresError

  if (beforeRepairError) throw beforeRepairError

  const existingAccessStoreIds = new Set((myAccessBeforeRepair || []).map((row: any) => String(row.store_id)))
  const missingOwnedStores = (ownedStores || []).filter((store: any) => !existingAccessStoreIds.has(String(store.id)))

  if (missingOwnedStores.length > 0) {
    const repairRows = missingOwnedStores.map((store: any) => ({
      store_id: store.id,
      user_id: userId,
      role: 'admin'
    }))

    const { error: repairError } = await supabase.from('store_access').upsert(repairRows, { onConflict: 'store_id,user_id' })

    if (repairError) {
      accessWarning = 'Δεν έγινε αυτόματη επιδιόρθωση δικαιωμάτων.'
    }
  }

  // Διορθωμένο query για να παίρνει τα stores
  const { data: access, error } = await supabase
    .from('store_access')
    .select('store_id, stores:stores(id, name)')
    .eq('user_id', userId)

  if (error) throw error

  if (!access || access.length === 0) {
    return {
      stores: [],
      accessWarning: accessWarning || 'Δεν έχετε δικαιώματα πρόσβασης.'
    }
  }

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const stores = access
    .map((item: any) => {
      const store = Array.isArray(item.stores) ? item.stores[0] : item.stores
      if (!store) return null
      return {
        id: String(store.id),
        name: String(store.name || 'Κατάστημα')
      }
    })
    .filter((store): store is { id: string; name: string } => store !== null)

  const uniqueStores = Array.from(new Map(stores.map((store) => [store.id, store])).values())
  const storeIds = uniqueStores.map((store) => store.id)

  const statsByStoreId = new Map<string, { income: number; expenses: number; lastUpdated: string | null }>()
  uniqueStores.forEach((store) => {
    statsByStoreId.set(store.id, { income: 0, expenses: 0, lastUpdated: null })
  })

  if (storeIds.length > 0) {
    const { data: trans, error: transError } = await supabase
      .from('transactions')
      .select('store_id, amount, type, date')
      .in('store_id', storeIds)
      .gte('date', firstDay)
      .order('date', { ascending: false })

    if (transError) throw transError

    for (const tx of trans || []) {
      const storeId = String((tx as { store_id?: string }).store_id || '')
      if (!storeId) continue

      const current = statsByStoreId.get(storeId)
      if (!current) continue

      const amount = Number((tx as { amount?: number | string }).amount) || 0
      const type = String((tx as { type?: string }).type || '')
      const date = String((tx as { date?: string }).date || '') || null

      if (type === 'income') {
        current.income += amount
      }

      if (type === 'expense' || type === 'debt_payment') {
        current.expenses += Math.abs(amount)
      }

      if (!current.lastUpdated && date) {
        current.lastUpdated = date
      }
    }
  }

  const storesWithStats: StoreCard[] = uniqueStores.map((store) => {
    const stats = statsByStoreId.get(store.id) || { income: 0, expenses: 0, lastUpdated: null }
    return {
      id: store.id,
      name: store.name,
      income: stats.income,
      expenses: stats.expenses,
      profit: stats.income - stats.expenses,
      lastUpdated: stats.lastUpdated
    }
  })

  return {
    stores: storesWithStats,
    accessWarning
  }
}

export const refreshStoresCache = async (userId: string) => {
  const result = await fetchStoresWithStats(userId)
  writeStoresCache(userId, result)
  return result
}

export const prefetchStoresForUser = async (userId: string) => {
  try {
    await refreshStoresCache(userId)
  } catch (e) {
    console.error("Prefetch error:", e)
  }
}