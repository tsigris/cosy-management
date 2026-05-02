import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated?: string | null
  organization_id?: string | null
  organizationId?: string | null
  owner_id?: string | null
  ownerId?: string | null
  accessRole?: string | null
}

export async function deleteStore(storeId: string, organizationId: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('stores')
    .delete()
    .eq('id', storeId)
    .eq('organization_id', organizationId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('Δεν μπορεί να διαγραφεί γιατί υπάρχουν κινήσεις/δεδομένα σε αυτό το κατάστημα.')
    }
    throw error
  }
}

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  // Το userId πλέον δεν χρησιμοποιείται για filtering στη βάση (το κάνει το auth.uid() μέσω view),
  // αλλά το κρατάμε για να μην πειράξουμε τα calls στο project.
  if (!userId) return []

  const supabase = getSupabase()

  // ✅ Ασφαλές: το view επιστρέφει ΜΟΝΟ stores που έχει ο τρέχων χρήστης (auth.uid()) από store_access
  const { data, error } = await supabase
    .from('v_my_store_stats')
    .select('id, name, income, expenses, profit, last_updated')
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchStoresForUser v_my_store_stats error:', error)
    throw error
  }

  const storeIds = (data ?? []).map((row: any) => String(row.id)).filter(Boolean)
  let latestTxByStoreId: Record<string, string> = {}
  let accessRoleByStoreId: Record<string, string> = {}
  let storeMetaByStoreId: Record<string, { organizationId: string | null; ownerId: string | null }> = {}

  if (storeIds.length > 0) {
    const [txRes, accessRes, metaRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('store_id, created_at')
        .in('store_id', storeIds)
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('store_access')
        .select('store_id, role')
        .eq('user_id', userId)
        .in('store_id', storeIds),
      supabase
        .from('stores')
        .select('id, organization_id, owner_id')
        .in('id', storeIds),
    ])

    if (txRes.error) {
      console.error('fetchStoresForUser latest transactions error:', txRes.error)
    } else {
      latestTxByStoreId = (txRes.data ?? []).reduce((acc: Record<string, string>, tx: any) => {
        const storeId = String(tx?.store_id || '')
        const createdAt = tx?.created_at ? String(tx.created_at) : ''
        if (!storeId || !createdAt || acc[storeId]) return acc
        acc[storeId] = createdAt
        return acc
      }, {})
    }

    if (accessRes.error) {
      console.error('fetchStoresForUser store_access roles error:', accessRes.error)
    } else {
      accessRoleByStoreId = (accessRes.data ?? []).reduce((acc: Record<string, string>, row: any) => {
        const storeId = String(row?.store_id || '')
        const role = String(row?.role || '')
        if (!storeId) return acc
        acc[storeId] = role
        return acc
      }, {})
    }

    if (metaRes.error) {
      console.error('fetchStoresForUser stores meta error:', metaRes.error)
    } else {
      storeMetaByStoreId = (metaRes.data ?? []).reduce(
        (acc: Record<string, { organizationId: string | null; ownerId: string | null }>, row: any) => {
          const id = String(row?.id || '')
          if (!id) return acc
          acc[id] = {
            organizationId: row?.organization_id ? String(row.organization_id) : null,
            ownerId: row?.owner_id ? String(row.owner_id) : null,
          }
          return acc
        },
        {}
      )
    }
  }

  return (data ?? []).map((row: any) => {
    const income = Number(row.income) || 0
    const expenses = Number(row.expenses) || 0
    const storeId = String(row.id)
    const lastUpdated = latestTxByStoreId[storeId] ?? (row.last_updated ? String(row.last_updated) : null)
    const role = accessRoleByStoreId[storeId] ?? null
    const meta = storeMetaByStoreId[storeId] ?? { organizationId: null, ownerId: null }

    return {
      id: storeId,
      name: String(row.name || ''),
      income,
      expenses,
      // Expenses are stored as negative values, so net is income + expenses.
      profit: income + expenses,
      lastUpdated,
      organization_id: meta.organizationId,
      organizationId: meta.organizationId,
      owner_id: meta.ownerId,
      ownerId: meta.ownerId,
      accessRole: role,
    }
  })
}