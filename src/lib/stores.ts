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

// --- UTILS ΓΙΑ CACHE ---
const getStoresCacheKey = (userId: string) => `${STORES_CACHE_PREFIX}${userId}`

export const readStoresCache = (userId: string): StoresCachePayload | null => {
  if (typeof window === 'undefined' || !userId) return null
  try {
    const raw = localStorage.getItem(getStoresCacheKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as StoresCachePayload
  } catch (err) {
    console.error("Cache read error:", err)
    return null
  }
}

export const writeStoresCache = (userId: string, payload: StoresFetchResult) => {
  if (typeof window === 'undefined' || !userId) return
  
  // ΠΡΟΣΤΑΣΙΑ: Αν η βάση επιστρέψει 0 stores αλλά η cache έχει ήδη μέσα δεδομένα,
  // ΜΗΝ γράφεις το κενό αποτέλεσμα. Πιθανότατα είναι σφάλμα του session στο κινητό.
  if (payload.stores.length === 0) {
    const existing = readStoresCache(userId)
    if (existing && existing.stores.length > 0) return
  }

  const value: StoresCachePayload = {
    stores: payload.stores,
    accessWarning: payload.accessWarning,
    updatedAt: Date.now()
  }
  localStorage.setItem(getStoresCacheKey(userId), JSON.stringify(value))
}

// --- Η ΚΥΡΙΑ ΣΥΝΑΡΤΗΣΗ ΑΝΑΚΤΗΣΗΣ ---
export const fetchStoresWithStats = async (userId: string): Promise<StoresFetchResult> => {
  if (!userId) return { stores: [], accessWarning: 'User ID missing' }

  try {
    // 1. Κλήση RPC για ταχύτητα και υπολογισμό stats στη βάση
    const { data, error } = await supabase.rpc('get_user_stores_with_monthly_stats')

    if (error) throw error

    const rows = (data ?? []) as any[]

    // 2. Αν η βάση επιστρέψει 0, ελέγχουμε την cache πριν τα παρατήσουμε
    if (rows.length === 0) {
      const cached = readStoresCache(userId)
      if (cached && cached.stores.length > 0) {
        return { stores: cached.stores, accessWarning: '' }
      }
      return { stores: [], accessWarning: '' }
    }

    // 3. Mapping των δεδομένων στα σωστά Types
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

    return { stores, accessWarning: '' }

  } catch (error: any) {
    console.error('Fetch error - falling back to cache:', error)
    
    // Fallback στην Cache σε περίπτωση που "πέσει" το δίκτυο ή η Supabase
    const cached = readStoresCache(userId)
    return {
      stores: cached?.stores || [],
      accessWarning: cached ? '' : 'Πρόβλημα σύνδεσης με τη βάση.'
    }
  }
}

// --- HELPER FUNCTIONS ΓΙΑ ΤΟ UI ---
export const refreshStoresCache = async (userId: string) => {
  const result = await fetchStoresWithStats(userId)
  // Γράφουμε στην cache μόνο αν βρήκαμε πραγματικά δεδομένα
  if (result.stores.length > 0) {
    writeStoresCache(userId, result)
  }
  return result
}

export const prefetchStoresForUser = async (userId: string): Promise<StoresFetchResult | null> => {
  try {
    const result = await fetchStoresWithStats(userId)
    if (result.stores.length > 0) {
      writeStoresCache(userId, result)
    }
    return result
  } catch (e) {
    console.error("Prefetch error:", e)
    return null
  }
}

export const clearStoresCacheForUser = (userId: string) => {
  if (typeof window !== 'undefined' && userId) {
    localStorage.removeItem(getStoresCacheKey(userId))
  }
}