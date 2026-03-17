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

  return (data ?? []).map((row: any) => {
    const income = Number(row.income) || 0
    const expenses = Number(row.expenses) || 0

    return {
      id: String(row.id),
      name: String(row.name || ''),
      income,
      expenses,
      // Expenses are stored as negative values, so net is income + expenses.
      profit: income + expenses,
      lastUpdated: row.last_updated ?? null,
    }
  })
}