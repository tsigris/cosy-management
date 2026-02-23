import { getSupabase } from '@/lib/supabase'

export type StoreCard = {
  id: string
  name: string
  income: number
  expenses: number
  profit: number
  lastUpdated?: string | null
}

const supabase = getSupabase()

export async function fetchStoresForUser(userId: string): Promise<StoreCard[]> {
  if (!userId) return []

  // φέρνουμε stores + balances μαζί
  const { data, error } = await supabase
    .from('stores')
    .select(`
      id,
      name,
      owner_id,
      v_financial_balances (
        credit_income,
        credit_expenses
      )
    `)
    .eq('owner_id', userId)
    .order('name')

  if (error) {
    console.error('fetchStoresForUser error:', error)
    throw error
  }

  return (data ?? []).map((store: any) => {
    const balances = store.v_financial_balances?.[0]

    const income = Number(balances?.credit_income) || 0
    const expenses = Number(balances?.credit_expenses) || 0
    const profit = income - expenses

    return {
      id: store.id,
      name: store.name,
      income,
      expenses,
      profit,
      lastUpdated: null,
    }
  })
}